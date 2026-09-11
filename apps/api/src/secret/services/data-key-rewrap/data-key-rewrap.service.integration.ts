import { faker } from "@faker-js/faker";
import type { KeyManagementServiceClient } from "@google-cloud/kms";
import { decodeProtectedHeader } from "jose";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { SdlSecretsKmsTargetFactory } from "@src/deployment/providers/kms.provider";
import { createSdlSecretsKmsTarget, KMS_CLIENT } from "@src/deployment/providers/kms.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import { UserRepository } from "@src/user/repositories";
import { DataKeyRewrapService } from "./data-key-rewrap.service";

const PROJECT = "console-dev-mock";
const LOCATION = "global";
const KEY_RING = "console-api";
const KEY = "sdl-secrets";

const kmsClient = container.resolve<KeyManagementServiceClient>(KMS_CLIENT);

function versionPath(version: string) {
  return kmsClient.cryptoKeyVersionPath(PROJECT, LOCATION, KEY_RING, KEY, version);
}

async function createEnabledVersion() {
  const [created] = await kmsClient.createCryptoKeyVersion({
    parent: kmsClient.cryptoKeyPath(PROJECT, LOCATION, KEY_RING, KEY),
    cryptoKeyVersion: {}
  });

  expect(created.state).toBe("ENABLED");

  return created.name!.split("/").pop()!;
}

/** Provisioned once: every RSA-3072 keypair the emulator mints costs real CPU on the same host the database runs on, and no test mutates the pair. */
let rotationPair: Promise<{ oldVersion: string; newVersion: string }> | undefined;

function enabledRotationPair() {
  rotationPair ??= Promise.all([createEnabledVersion(), createEnabledVersion()])
    .then(([oldVersion, newVersion]) => ({ oldVersion, newVersion }))
    .catch(error => {
      rotationPair = undefined;
      throw error;
    });

  return rotationPair;
}

describe(`${DataKeyRewrapService.name} against Cloud KMS`, () => {
  it("leaves every stored secret opening to the plaintext it was sealed with", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { seedUser, rewrapOnto, consoleAt } = setup();
    const alpha = await seedUser(oldVersion, "alpha-plaintext");
    const bravo = await seedUser(oldVersion, "bravo-plaintext");

    await rewrapOnto(newVersion);

    const afterRotation = consoleAt(newVersion);
    await expect(afterRotation.openStoredSecret(alpha)).resolves.toBe("alpha-plaintext");
    await expect(afterRotation.openStoredSecret(bravo)).resolves.toBe("bravo-plaintext");
  });

  it("leaves every stored secrets token byte-identical, and says so in its fingerprint", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { seedUser, rewrapOnto, readStoredSecrets } = setup();
    await seedUser(oldVersion, "alpha-plaintext");
    await seedUser(oldVersion, "bravo-plaintext");
    const before = await readStoredSecrets();

    const report = await rewrapOnto(newVersion);

    expect(await readStoredSecrets()).toEqual(before);
    expect(report.secretsDrift).toEqual({ corruptedIds: [], changedConcurrently: 0, added: 0, removed: 0 });
    expect(report.fingerprint.after).toEqual(report.fingerprint.before);
    expect(report.fingerprint.before).toMatchObject({ rowCount: 2 });
  });

  it("re-wraps every row onto the target without changing the key it wraps", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { seedUser, rewrapOnto, readDataKeys, consoleAt } = setup();
    const alpha = await seedUser(oldVersion, "alpha-plaintext");
    const keyBeforeRotation = await consoleAt(oldVersion).unwrapFor(alpha.userId);
    const [rowBefore] = await readDataKeys();

    await rewrapOnto(newVersion);

    const [rowAfter] = await readDataKeys();
    expect(rowAfter.wrappedByKid).toBe(`${KEY}.v${newVersion}`);
    expect(decodeProtectedHeader(rowAfter.wrappedKey).kid).toBe(`${KEY}.v${newVersion}`);
    expect(rowAfter.wrappedKey).not.toBe(rowBefore.wrappedKey);
    expect((await consoleAt(newVersion).unwrapFor(alpha.userId)).equals(keyBeforeRotation)).toBe(true);
  });

  it("re-runs as a no-op that spends no call on the key service", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { seedUser, rewrapOnto } = setup();
    await seedUser(oldVersion, "alpha-plaintext");
    await rewrapOnto(newVersion);
    const asymmetricDecrypt = vi.spyOn(kmsClient, "asymmetricDecrypt");

    const report = await rewrapOnto(newVersion);

    expect(report).toMatchObject({ dataKeysRewrapped: 0, fromVersions: [], census: { [`${KEY}.v${newVersion}`]: 1 } });
    expect(asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("leaves a failed batch whole, the batches before it committed, and finishes on a re-run", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { seedUser, rewrapOnto, readDataKeys, readStoredSecrets, failWriteOf } = setup();
    for (const plaintext of ["alpha", "bravo", "charlie", "delta"]) {
      await seedUser(oldVersion, `${plaintext}-plaintext`);
    }
    const before = await readStoredSecrets();
    const rows = await readDataKeys();
    failWriteOf(rows[3].id);

    await expect(rewrapOnto(newVersion, { batchSize: 2 })).rejects.toThrow();

    const afterFailure = await readDataKeys();
    expect(afterFailure.map(row => row.wrappedByKid)).toEqual([
      `${KEY}.v${newVersion}`,
      `${KEY}.v${newVersion}`,
      `${KEY}.v${oldVersion}`,
      `${KEY}.v${oldVersion}`
    ]);

    vi.restoreAllMocks();
    const report = await rewrapOnto(newVersion, { batchSize: 2 });

    expect(report).toMatchObject({ dataKeysRewrapped: 2, dataKeysFailed: 0 });
    expect((await readDataKeys()).every(row => row.wrappedByKid === `${KEY}.v${newVersion}`)).toBe(true);
    expect(await readStoredSecrets()).toEqual(before);
  });

  it("reports on a dry run what a real run then moves, having written nothing", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { seedUser, seedUserWithoutDataKey, rewrapOnto, readDataKeys, countDataKeys, readStoredSecrets } = setup();
    await seedUser(oldVersion, "alpha-plaintext");
    await seedUser(oldVersion, "bravo-plaintext");
    await seedUserWithoutDataKey();
    const dataKeysBefore = await readDataKeys();
    const dataKeyCountBefore = await countDataKeys();
    const secretsBefore = await readStoredSecrets();

    const rehearsal = await rewrapOnto(newVersion, { dryRun: true });

    expect(await readDataKeys()).toEqual(dataKeysBefore);
    expect(await countDataKeys()).toBe(dataKeyCountBefore);
    expect(await readStoredSecrets()).toEqual(secretsBefore);
    expect(rehearsal).toMatchObject({ dryRun: true, dataKeysRewrapped: 2, census: { [`${KEY}.v${oldVersion}`]: 2 } });
    expect(rehearsal.fingerprint.after).toBeUndefined();

    const real = await rewrapOnto(newVersion);
    expect(real.dataKeysRewrapped).toBe(rehearsal.dataKeysRewrapped);
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup?.();
  });

  function setup() {
    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const userRepository = container.resolve(UserRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const txService = container.resolve(TxService);
    const createdUserIds: string[] = [];

    cleanup = async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    };

    const createKmsTarget: SdlSecretsKmsTargetFactory = version => createSdlSecretsKmsTarget({ client: kmsClient, versionPath, key: KEY, version });

    const consoleAt = (version: string) => {
      const target = createKmsTarget(version);
      const wrappedJwe = new KmsWrappedJweService(target);
      const sealingKeyService = new SdlSecretsSealingKeyService(target, createLogger);
      const dataKeyService = new DataKeyService(dataKeyRepository, sealingKeyService, createLogger);
      const unwrapper = new DataKeyUnwrapperService(dataKeyService, executionContextService, wrappedJwe, target, createLogger);
      const cipher = new SecretCipherService(unwrapper, createLogger);

      return {
        warmSealingKey: async () => await sealingKeyService.getSealingKey(),
        ensureDataKey: async (userId: string) => await dataKeyService.ensureDataKey(userId),
        unwrapFor: async (userId: string) => await executionContextService.runWithContext(async () => await (await unwrapper.getDataKey(userId)).unwrap()),
        sealFor: async (userId: string, dseq: string, plaintext: string) =>
          await executionContextService.runWithContext(async () => await cipher.encrypt(userId, plaintext, { dseq })),
        openStoredSecret: async ({ userId, dseq }: SeededUser) =>
          await executionContextService.runWithContext(async () => {
            const setting = await deploymentSettingRepository.findOneBy({ userId, dseq });

            return await cipher.decrypt(userId, setting!.sealedSecrets!, { dseq });
          })
      };
    };

    async function seedUser(version: string, plaintext: string): Promise<SeededUser> {
      const user = await userRepository.create({});
      createdUserIds.push(user.id);

      const consoleApi = consoleAt(version);
      await consoleApi.warmSealingKey();
      await consoleApi.ensureDataKey(user.id);

      const dseq = faker.number.int({ min: 100000, max: 999999 }).toString();
      const sealedSecrets = await consoleApi.sealFor(user.id, dseq, plaintext);
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, sealedSecrets });

      return { userId: user.id, dseq };
    }

    async function rewrapOnto(targetVersion: string, options: { batchSize?: number; dryRun?: boolean } = {}) {
      const service = new DataKeyRewrapService(
        dataKeyRepository,
        deploymentSettingRepository,
        new KmsWrappedJweService(createKmsTarget(targetVersion)),
        txService,
        createKmsTarget,
        createLogger
      );

      return (await service.rewrapDataKeys({ targetVersion, dryRun: options.dryRun ?? false, batchSize: options.batchSize })).unwrap();
    }

    async function seedUserWithoutDataKey() {
      const user = await userRepository.create({});
      createdUserIds.push(user.id);

      return user;
    }

    async function countDataKeys() {
      return await dataKeyRepository.count({});
    }

    async function readDataKeys() {
      const rows = await dataKeyRepository.find({});

      return rows
        .filter(row => createdUserIds.includes(row.userId))
        .sort((left, right) => (left.id < right.id ? -1 : 1))
        .map(({ id, wrappedKey, wrappedByKid }) => ({ id, wrappedKey, wrappedByKid }));
    }

    async function readStoredSecrets() {
      const settings = [];

      for await (const batch of deploymentSettingRepository.findStoredSecretsIteratively({ batchSize: 100 })) {
        settings.push(...batch);
      }

      return settings.sort((left, right) => (left.id < right.id ? -1 : 1));
    }

    function failWriteOf(dataKeyId: string) {
      const updateById = dataKeyRepository.updateById.bind(dataKeyRepository);

      vi.spyOn(dataKeyRepository, "updateById").mockImplementation(async (id, payload) => {
        if (id === dataKeyId) {
          throw new Error(`write of ${dataKeyId} failed`);
        }

        await updateById(id, payload);
      });
    }

    return { consoleAt, seedUser, seedUserWithoutDataKey, rewrapOnto, readDataKeys, countDataKeys, readStoredSecrets, failWriteOf };
  }
});

interface SeededUser {
  userId: string;
  dseq: string;
}
