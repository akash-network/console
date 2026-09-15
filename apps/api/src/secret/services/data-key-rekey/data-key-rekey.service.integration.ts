import { faker } from "@faker-js/faker";
import type { KeyManagementServiceClient } from "@google-cloud/kms";
import { decodeProtectedHeader } from "jose";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { createSdlSecretsKmsTarget, KMS_CLIENT } from "@src/deployment/providers/kms.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { KmsWrappedJweInstrumentationService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe-instrumentation.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import type { DataKeyUnwrapInstrumentationService } from "@src/secret/services/data-key-unwrapper/data-key-unwrap-instrumentation.service";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import { UserRepository } from "@src/user/repositories";
import { DataKeyRekeyService, MIN_RETIREMENT_AGE_BEFORE_DELETE_MS } from "./data-key-rekey.service";

const PROJECT = "console-dev-mock";
const LOCATION = "global";
const KEY_RING = "console-api";
const KEY = "sdl-secrets";

const kmsClient = container.resolve<KeyManagementServiceClient>(KMS_CLIENT);

function versionPath(version: string) {
  return kmsClient.cryptoKeyVersionPath(PROJECT, LOCATION, KEY_RING, KEY, version);
}

/** Provisioned once: every RSA-3072 keypair the emulator mints costs real CPU on the same host the database runs on, and no test mutates it. */
let enabledVersion: Promise<string> | undefined;

function sharedEnabledVersion() {
  enabledVersion ??= kmsClient
    .createCryptoKeyVersion({ parent: kmsClient.cryptoKeyPath(PROJECT, LOCATION, KEY_RING, KEY), cryptoKeyVersion: {} })
    .then(([created]) => created.name!.split("/").pop()!)
    .catch(error => {
      enabledVersion = undefined;
      throw error;
    });

  return enabledVersion;
}

describe(`${DataKeyRekeyService.name} against Cloud KMS`, () => {
  it("re-seals every stored secret of one user to the same values under a new key, naming the same owner and deployment", async () => {
    const { seedUser, rekey, openAll, tokensOf, dataKeysOf } = await setup();
    const secrets = { "100": { DB_URL: "postgres://alpha", API_TOKEN: "alpha-token" }, "200": { KEY: "alpha-key" } };
    const alpha = await seedUser(secrets);
    const [keyBefore] = await dataKeysOf(alpha);

    const report = await rekey(alpha);

    expect(report).toMatchObject({ deploymentsResealed: 2, secretsResealed: 3, retiredDataKeyId: keyBefore.id, retiredDataKeyDeleted: false });
    expect(await openAll(alpha)).toEqual(secrets);
    for (const [dseq, token] of Object.entries(await tokensOf(alpha))) {
      expect(decodeProtectedHeader(token)).toEqual({ sub: alpha, dseq, alg: "dir", enc: "A256GCM", kid: report.activeDataKeyId });
    }
    expect(report.activeDataKeyId).not.toBe(keyBefore.id);
  });

  it("touches no other user", async () => {
    const { seedUser, rekey, tokensOf, dataKeysOf } = await setup();
    const alpha = await seedUser({ "100": { A: "alpha" } });
    const bravo = await seedUser({ "300": { B: "bravo" } });
    const bravoTokensBefore = await tokensOf(bravo);
    const bravoKeysBefore = await dataKeysOf(bravo);

    await rekey(alpha);

    expect(await tokensOf(bravo)).toEqual(bravoTokensBefore);
    expect(await dataKeysOf(bravo)).toEqual(bravoKeysBefore);
  });

  it("leaves every secret openable and both keys in place when a write fails partway, and finishes on a re-run", async () => {
    const { seedUser, rekey, attemptRekey, openAll, tokensOf, dataKeysOf, failWriteOfDseq } = await setup();
    const secrets = { "100": { A: "one" }, "200": { B: "two" } };
    const alpha = await seedUser(secrets);
    const tokensBefore = await tokensOf(alpha);
    failWriteOfDseq("200");

    const failed = await attemptRekey(alpha);

    expect(failed.err).toBe(true);
    expect(await dataKeysOf(alpha)).toHaveLength(2);
    expect(await openAll(alpha)).toEqual(secrets);
    const tokensAfterFailure = await tokensOf(alpha);
    expect(tokensAfterFailure["100"]).not.toBe(tokensBefore["100"]);
    expect(tokensAfterFailure["200"]).toBe(tokensBefore["200"]);

    vi.restoreAllMocks();
    const report = await rekey(alpha);

    expect(report).toMatchObject({ deploymentsResealed: 1, deploymentsAlreadyUnderActiveKey: 1 });
    expect(await openAll(alpha)).toEqual(secrets);
  });

  it("deletes the retired key only on a run a minute or more after retiring it, once nothing is sealed under it", async () => {
    const { seedUser, rekey, openAll, dataKeysOf, sealNewDeployment, backdateRetirement } = await setup();
    const alpha = await seedUser({ "100": { A: "one" } });

    const first = await rekey(alpha);
    expect(first.retiredDataKeyDeleted).toBe(false);
    expect(first.retiredDataKeyDeletableAfter!.getTime() - Date.now()).toBeGreaterThan(MIN_RETIREMENT_AGE_BEFORE_DELETE_MS / 2);
    expect(await dataKeysOf(alpha)).toHaveLength(2);

    await sealNewDeployment(alpha, "500", { C: "deployed-between-runs" });
    await backdateRetirement(first.retiredDataKeyId!);
    const second = await rekey(alpha);

    expect(second).toMatchObject({ deploymentsResealed: 0, deploymentsAlreadyUnderActiveKey: 2, retiredDataKeyDeleted: true });
    expect((await dataKeysOf(alpha)).map(key => key.id)).toEqual([first.activeDataKeyId]);
    expect(await openAll(alpha)).toEqual({ "100": { A: "one" }, "500": { C: "deployed-between-runs" } });
  });

  it("reports on a dry run what a real run then re-seals, having retired and written nothing", async () => {
    const { seedUser, rekey, tokensOf, dataKeysOf } = await setup();
    const alpha = await seedUser({ "100": { A: "one" }, "200": { B: "two" } });
    const tokensBefore = await tokensOf(alpha);
    const keysBefore = await dataKeysOf(alpha);

    const rehearsal = await rekey(alpha, { dryRun: true });

    expect(rehearsal).toMatchObject({ dryRun: true, deploymentsResealed: 2, retiredDataKeyId: null, activeDataKeyId: keysBefore[0].id });
    expect(await tokensOf(alpha)).toEqual(tokensBefore);
    expect(await dataKeysOf(alpha)).toEqual(keysBefore);

    const real = await rekey(alpha);
    expect(real.deploymentsResealed).toBe(rehearsal.deploymentsResealed);
  });

  it("replaces the key of a user who stores no secret at all", async () => {
    const { seedUser, rekey, dataKeysOf } = await setup();
    const alpha = await seedUser({});

    const report = await rekey(alpha);

    expect(report).toMatchObject({ deploymentsResealed: 0, secretsResealed: 0 });
    expect(await dataKeysOf(alpha)).toHaveLength(2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup() {
    const version = await sharedEnabledVersion();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const userRepository = container.resolve(UserRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const txService = container.resolve(TxService);
    const createdUserIds: string[] = [];

    onTestFinished(async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    });

    const target = createSdlSecretsKmsTarget({ client: kmsClient, versionPath, key: KEY, version });
    const wrappedJwe = new KmsWrappedJweService(target, mock<KmsWrappedJweInstrumentationService>());
    const sealingKeyService = new SdlSecretsSealingKeyService(target, createLogger);
    await sealingKeyService.getSealingKey();
    const dataKeyService = new DataKeyService(dataKeyRepository, sealingKeyService, createLogger);
    const unwrapper = new DataKeyUnwrapperService(
      dataKeyService,
      executionContextService,
      wrappedJwe,
      mock<DataKeyUnwrapInstrumentationService>(),
      target,
      createLogger
    );
    const cipher = new SecretCipherService(unwrapper, createLogger);
    const sdlSecretsService = new SdlSecretsService(
      new SdlSecretsUnsealerService(target, wrappedJwe, mock<AuthService>(), createLogger),
      container.resolve(SdlReferenceService),
      cipher,
      container.resolve(DeploymentConfigService),
      createLogger
    );
    const service = new DataKeyRekeyService(
      dataKeyRepository,
      deploymentSettingRepository,
      userRepository,
      sdlSecretsService,
      sealingKeyService,
      txService,
      executionContextService,
      createLogger
    );

    const inRequest = <R>(cb: () => Promise<R>) => executionContextService.runWithContext(cb);

    async function sealNewDeployment(userId: string, dseq: string, secrets: SdlSecrets) {
      const sealedSecrets = await inRequest(async () => await sdlSecretsService.sealForStorage({ userId, dseq, secrets }));
      await deploymentSettingRepository.create({ userId, dseq, autoTopUpEnabled: false, sealedSecrets });
    }

    async function seedUser(secretsByDseq: Record<string, SdlSecrets>) {
      const user = await userRepository.create({ userId: faker.string.uuid() });
      createdUserIds.push(user.id);
      await dataKeyService.ensureDataKey(user.id);

      for (const [dseq, secrets] of Object.entries(secretsByDseq)) {
        await sealNewDeployment(user.id, dseq, secrets);
      }

      return user.id;
    }

    async function attemptRekey(userId: string, options: { dryRun?: boolean } = {}) {
      return await service.rekeyUser({ userId, dryRun: options.dryRun ?? false });
    }

    async function rekey(userId: string, options: { dryRun?: boolean } = {}) {
      return (await attemptRekey(userId, options)).unwrap();
    }

    async function tokensOf(userId: string) {
      const rows = await deploymentSettingRepository.find({ userId });

      return Object.fromEntries(rows.filter(row => row.sealedSecrets).map(row => [row.dseq, row.sealedSecrets!]));
    }

    async function openAll(userId: string) {
      const tokens = await tokensOf(userId);

      return await inRequest(async () =>
        Object.fromEntries(
          await Promise.all(
            Object.entries(tokens).map(async ([dseq, sealedSecrets]) => [dseq, await sdlSecretsService.openStored({ userId, dseq, sealedSecrets })])
          )
        )
      );
    }

    async function dataKeysOf(userId: string) {
      const rows = await dataKeyRepository.find({ userId });

      return rows.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    }

    function failWriteOfDseq(dseq: string) {
      const resealIfUnchanged = deploymentSettingRepository.resealIfUnchanged.bind(deploymentSettingRepository);
      const findStoredSecretsByUserIteratively = deploymentSettingRepository.findStoredSecretsByUserIteratively.bind(deploymentSettingRepository);
      const failingIds = new Set<string>();

      vi.spyOn(deploymentSettingRepository, "findStoredSecretsByUserIteratively").mockImplementation(async function* (input) {
        for await (const batch of findStoredSecretsByUserIteratively(input)) {
          batch.filter(row => row.dseq === dseq).forEach(row => failingIds.add(row.id));
          yield batch;
        }
      });
      vi.spyOn(deploymentSettingRepository, "resealIfUnchanged").mockImplementation(async (id, sealedSecrets, resealed) => {
        if (failingIds.has(id)) throw new Error(`write of ${dseq} failed`);

        return await resealIfUnchanged(id, sealedSecrets, resealed);
      });
    }

    async function backdateRetirement(dataKeyId: string) {
      await dataKeyRepository.updateById(dataKeyId, { retiredAt: new Date(Date.now() - 2 * MIN_RETIREMENT_AGE_BEFORE_DELETE_MS) });
    }

    return { seedUser, rekey, attemptRekey, openAll, tokensOf, dataKeysOf, sealNewDeployment, failWriteOfDseq, backdateRetirement, logger };
  }
});
