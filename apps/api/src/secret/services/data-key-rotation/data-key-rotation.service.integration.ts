import { faker } from "@faker-js/faker";
import type { KeyManagementServiceClient } from "@google-cloud/kms";
import { eq, sql } from "drizzle-orm";
import { decodeProtectedHeader } from "jose";
import { randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { createSdlSecretsKmsTarget, KMS_CLIENT } from "@src/deployment/providers/kms.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { StoredSecretFingerprintService } from "@src/deployment/services/stored-secret-fingerprint/stored-secret-fingerprint.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import { UserRepository } from "@src/user/repositories";
import { DataKeyRotationService } from "./data-key-rotation.service";

const PROJECT = "console-dev-mock";
const LOCATION = "global";
const KEY_RING = "console-api";
const KEY = "sdl-secrets";
const SDL = "version: '2.0'";

const kmsClient = container.resolve<KeyManagementServiceClient>(KMS_CLIENT);

function versionPath(version: string) {
  return kmsClient.cryptoKeyVersionPath(PROJECT, LOCATION, KEY_RING, KEY, version);
}

async function createEnabledVersion() {
  const [created] = await kmsClient.createCryptoKeyVersion({
    parent: kmsClient.cryptoKeyPath(PROJECT, LOCATION, KEY_RING, KEY),
    cryptoKeyVersion: {}
  });

  return created.name!.split("/").pop()!;
}

/** Provisioned once: every RSA-3072 keypair the emulator mints costs real CPU on the same host the database runs on, and no test mutates the pair. */
let rotationPair: Promise<{ oldVersion: string; newVersion: string }> | undefined;

function enabledRotationPair() {
  rotationPair ??= Promise.all([createEnabledVersion(), createEnabledVersion()]).then(([oldVersion, newVersion]) => ({ oldVersion, newVersion }));

  return rotationPair;
}

describe(DataKeyRotationService.name, () => {
  it("refuses a target version that is not enabled, before any secret is measured or any row touched", async () => {
    const disabledVersion = await createEnabledVersion();
    const { storeUserWithSecrets, rotationAt, sweepSealedSecrets, storedDataKeys } = await setup();
    await storeUserWithSecrets((await enabledRotationPair()).oldVersion);
    const before = await storedDataKeys();
    const asymmetricDecrypt = vi.spyOn(kmsClient, "asymmetricDecrypt");
    await kmsClient.updateCryptoKeyVersion({ cryptoKeyVersion: { name: versionPath(disabledVersion), state: "DISABLED" }, updateMask: { paths: ["state"] } });

    const result = await rotationAt(disabledVersion).rotate({ targetVersion: disabledVersion, dryRun: false });

    expect(result.err).toBe(true);
    expect(sweepSealedSecrets).not.toHaveBeenCalled();
    expect(asymmetricDecrypt).not.toHaveBeenCalled();
    expect(await storedDataKeys()).toEqual(before);
  });

  it("moves every data key onto the target version in id order and in batches, leaving every stored secret as it was", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { storeUserWithSecrets, rotationAt, dataKeyRepository, storedSecretsOf, loggedEvents } = await setup();
    const users = [];
    for (let index = 0; index < 5; index++) users.push(await storeUserWithSecrets(oldVersion));
    const secretsBefore = await storedSecretsOf(users);
    const wrapBefore = (await dataKeyRepository.findByUserId(users[0].id))!;
    const keyBefore = await users[0].unwrapDataKeyAt(oldVersion);

    const result = await rotationAt(newVersion).rotate({ targetVersion: newVersion, batchSize: 2, dryRun: false });

    const report = result.unwrap();
    expect(report).toMatchObject({
      usersReWrapped: 5,
      secretsReEncrypted: 0,
      concurrentSecretWrites: 0,
      fromVersions: { [`${KEY}.v${oldVersion}`]: 5 },
      toVersion: `${KEY}.v${newVersion}`,
      dataKeysByVersion: { [`${KEY}.v${newVersion}`]: 5 }
    });
    expect(report.fingerprintAfter).toEqual(report.fingerprintBefore);
    expect(report.bytesRewritten).toBeGreaterThan(0);
    const batches = loggedEvents("KEY_ROTATION_BATCH");
    expect(batches.map(batch => batch.rowCount)).toEqual([2, 2, 1]);
    expect(batches.map(batch => batch.firstId)).toEqual([...batches.map(batch => batch.firstId)].sort());
    expect(await dataKeyRepository.countWrappedUnder(`${KEY}.v${oldVersion}`)).toBe(0);
    expect(await storedSecretsOf(users)).toEqual(secretsBefore);

    for (const user of users) {
      expect(await user.openStoredSecretsAt(newVersion)).toEqual(user.secrets);
      expect(decodeProtectedHeader((await storedSecretsOf([user]))[0].sealedSecrets!)).toEqual(user.sealedHeader);
    }

    const wrapAfter = (await dataKeyRepository.findByUserId(users[0].id))!;
    expect(wrapAfter.id).toBe(wrapBefore.id);
    expect(wrapAfter.wrappedKey).not.toBe(wrapBefore.wrappedKey);
    expect(decodeProtectedHeader(wrapAfter.wrappedKey)).toEqual({ ...decodeProtectedHeader(wrapBefore.wrappedKey), kid: `${KEY}.v${newVersion}` });
    expect((await users[0].unwrapDataKeyAt(newVersion)).equals(keyBefore)).toBe(true);
  });

  it("continues an interrupted run and spends nothing on a fleet already rotated", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { storeUserWithSecrets, rotationAt, dataKeyRepository } = await setup();
    for (let index = 0; index < 3; index++) await storeUserWithSecrets(oldVersion);
    const rotation = rotationAt(newVersion);
    const rewrapRow = dataKeyRepository.rewrapIfStillWrappedUnder.bind(dataKeyRepository);
    const interrupted = vi
      .spyOn(dataKeyRepository, "rewrapIfStillWrappedUnder")
      .mockImplementationOnce(rewrapRow)
      .mockImplementationOnce(async () => {
        throw new Error("connection lost");
      });

    const first = await rotation.rotate({ targetVersion: newVersion, batchSize: 1, dryRun: false });
    interrupted.mockRestore();
    const asymmetricDecrypt = vi.spyOn(kmsClient, "asymmetricDecrypt");
    const second = await rotation.rotate({ targetVersion: newVersion, batchSize: 1, dryRun: false });
    const unwrapsOfSecondRun = asymmetricDecrypt.mock.calls.length;
    const third = await rotation.rotate({ targetVersion: newVersion, dryRun: false });

    expect(first.err).toBe(true);
    expect(second.unwrap().usersReWrapped).toBe(2);
    expect(unwrapsOfSecondRun).toBe(2);
    expect(third.unwrap().usersReWrapped).toBe(0);
    expect(asymmetricDecrypt.mock.calls.length).toBe(unwrapsOfSecondRun);
    expect(await dataKeyRepository.countWrappedUnder(`${KEY}.v${oldVersion}`)).toBe(0);
  });

  it("steps over an unreadable wrapped key and moves the rest of the fleet anyway", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { storeUserWithSecrets, rotationAt, dataKeyRepository, corruptWrappedKey } = await setup();
    const [corrupted] = [await storeUserWithSecrets(oldVersion), await storeUserWithSecrets(oldVersion), await storeUserWithSecrets(oldVersion)];
    await corruptWrappedKey(corrupted);
    const rotation = rotationAt(newVersion);

    const first = await rotation.rotate({ targetVersion: newVersion, batchSize: 3, dryRun: false });
    const rotatedRows = await dataKeyRepository.countWrappedUnder(`${KEY}.v${newVersion}`);
    const second = await rotation.rotate({ targetVersion: newVersion, batchSize: 3, dryRun: false });

    expect(first.val).toMatchObject({ report: { failed: 1, usersReWrapped: 2, secretsReEncrypted: 0 } });
    expect(rotatedRows).toBe(2);
    expect(second.val).toMatchObject({ report: { failed: 1, usersReWrapped: 0 } });
    expect(await dataKeyRepository.countWrappedUnder(`${KEY}.v${newVersion}`)).toBe(2);
  });

  it("serves a read of the same data key while it is being re-wrapped", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { storeUserWithSecrets, rotationAt, dataKeyRepository } = await setup();
    const user = await storeUserWithSecrets(oldVersion);

    const [rotated, readConcurrently] = await Promise.all([
      rotationAt(newVersion).rotate({ targetVersion: newVersion, dryRun: false }),
      user.unwrapDataKeyAt(oldVersion)
    ]);

    expect(rotated.unwrap().usersReWrapped).toBe(1);
    expect((await user.unwrapDataKeyAt(newVersion)).equals(readConcurrently)).toBe(true);
    expect((await dataKeyRepository.findByUserId(user.id))!.wrappedByKid).toBe(`${KEY}.v${newVersion}`);
  });

  it("counts what a run would move without opening or writing anything", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { storeUserWithSecrets, rotationAt, storedDataKeys } = await setup();
    for (let index = 0; index < 2; index++) await storeUserWithSecrets(oldVersion);
    const before = await storedDataKeys();
    const asymmetricDecrypt = vi.spyOn(kmsClient, "asymmetricDecrypt");

    const result = await rotationAt(newVersion).rotate({ targetVersion: newVersion, dryRun: true });

    expect(result.unwrap()).toMatchObject({ wouldReWrap: 2, usersReWrapped: 0 });
    expect(asymmetricDecrypt).not.toHaveBeenCalled();
    expect(await storedDataKeys()).toEqual(before);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.execute(sql`TRUNCATE TABLE ${resolveTable("Users")} CASCADE`);

    const userRepository = container.resolve(UserRepository);
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const fingerprintService = container.resolve(StoredSecretFingerprintService);
    const executionContextService = container.resolve(ExecutionContextService);
    const txService = container.resolve(TxService);
    const sweepSealedSecrets = vi.spyOn(deploymentSettingRepository, "findSealedSecretsIteratively");
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = (options = {}) => (options.context === DataKeyRotationService.name ? logger : mock<ReturnType<CreateLogger>>());

    const consoleAt = (version: string) => {
      const target = createSdlSecretsKmsTarget({ client: kmsClient, versionPath, key: KEY, version });
      const wrappedJwe = new KmsWrappedJweService(target);
      const sealingKeyService = new SdlSecretsSealingKeyService(target, createLogger);
      const dataKeyService = new DataKeyService(dataKeyRepository, sealingKeyService, createLogger);
      const unwrapper = new DataKeyUnwrapperService(dataKeyService, executionContextService, wrappedJwe, target, createLogger);

      return {
        target,
        sealingKeyService,
        wrappedJwe,
        dataKeyService,
        cipher: new SecretCipherService(unwrapper, createLogger),
        unwrapFor: async (userId: string) => await executionContextService.runWithContext(async () => await (await unwrapper.getDataKey(userId)).unwrap())
      };
    };

    const rotationAt = (version: string) => {
      const { target, sealingKeyService, wrappedJwe } = consoleAt(version);

      return new DataKeyRotationService(dataKeyRepository, fingerprintService, wrappedJwe, sealingKeyService, txService, target, createLogger);
    };

    async function storeUserWithSecrets(version: string) {
      const consoleApi = consoleAt(version);
      await consoleApi.sealingKeyService.getSealingKey();
      const user = await userRepository.create({});
      await consoleApi.dataKeyService.ensureDataKey(user.id);

      const dseq = faker.number.int({ min: 100000, max: 999999 }).toString();
      const secrets = { DB_URL: `postgres://app:${randomUUID()}@db.internal/app` };
      const sealedSecrets = await executionContextService.runWithContext(
        async () => await consoleApi.cipher.encrypt(user.id, JSON.stringify(secrets), { sub: user.id, dseq })
      );
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets });

      return {
        id: user.id,
        dseq,
        secrets,
        sealedHeader: decodeProtectedHeader(sealedSecrets),
        unwrapDataKeyAt: async (readAt: string) => await consoleAt(readAt).unwrapFor(user.id),
        openStoredSecretsAt: async (readAt: string) => {
          const stored = (await storedSecretsOf([{ id: user.id }]))[0].sealedSecrets!;

          return JSON.parse(
            await executionContextService.runWithContext(async () => await consoleAt(readAt).cipher.decrypt(user.id, stored, { sub: user.id, dseq }))
          );
        }
      };
    }

    async function storedSecretsOf(users: Array<{ id: string }>) {
      const rows = await Promise.all(users.map(async user => await deploymentSettingRepository.find({ userId: user.id })));

      return rows.flat().map(row => ({ id: row.id, sealedSecrets: row.sealedSecrets, updatedAt: row.updatedAt }));
    }

    async function storedDataKeys() {
      const rows = await dataKeyRepository.find({});

      return rows.map(row => ({ id: row.id, wrappedKey: row.wrappedKey, wrappedByKid: row.wrappedByKid })).sort((left, right) => left.id.localeCompare(right.id));
    }

    async function corruptWrappedKey(user: { id: string }) {
      const row = (await dataKeyRepository.findByUserId(user.id))!;
      const dataKeysTable = resolveTable("DataKeys");
      await db
        .update(dataKeysTable)
        .set({ wrappedKey: row.wrappedKey.slice(0, -20) })
        .where(eq(dataKeysTable.id, row.id));
    }

    function loggedEvents(name: string) {
      return (logger.info.mock.calls as Array<[Record<string, unknown>]>).map(([payload]) => payload).filter(payload => payload.event === name);
    }

    return { storeUserWithSecrets, rotationAt, dataKeyRepository, storedSecretsOf, storedDataKeys, corruptWrappedKey, sweepSealedSecrets, loggedEvents };
  }
});
