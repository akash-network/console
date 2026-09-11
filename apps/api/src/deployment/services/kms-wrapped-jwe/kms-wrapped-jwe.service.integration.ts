import type { KeyManagementServiceClient } from "@google-cloud/kms";
import { CompactEncrypt, decodeProtectedHeader } from "jose";
import { createPublicKey, randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { createSdlSecretsKmsTarget, KMS_CLIENT } from "@src/deployment/providers/kms.provider";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { KmsWrappedJweService } from "./kms-wrapped-jwe.service";

const PROJECT = "console-dev-mock";
const LOCATION = "global";
const KEY_RING = "console-api";
const KEY = "sdl-secrets";
const SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n';

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

async function disableVersion(version: string) {
  await kmsClient.updateCryptoKeyVersion({
    cryptoKeyVersion: { name: versionPath(version), state: "DISABLED" },
    updateMask: { paths: ["state"] }
  });
}

async function publicKeyOf(version: string) {
  const [publicKey] = await kmsClient.getPublicKey({ name: versionPath(version) });

  return createPublicKey(publicKey.pem!);
}

describe(`${KmsWrappedJweService.name} against Cloud KMS`, () => {
  it("opens a data key wrapped under an older enabled version once the configured version moves on", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { createTestUser, consoleAt } = setup();
    const user = await createTestUser();

    const beforeRotation = consoleAt(oldVersion);
    await beforeRotation.warmSealingKey();
    const row = await beforeRotation.dataKeyService.ensureDataKey(user.id);
    const keyBeforeRotation = await beforeRotation.unwrapFor(user.id);

    const keyAfterRotation = await consoleAt(newVersion).unwrapFor(user.id);

    expect(row.wrappedByKid).toBe(`${KEY}.v${oldVersion}`);
    expect(keyAfterRotation).toHaveLength(32);
    expect(keyAfterRotation.equals(keyBeforeRotation)).toBe(true);
  });

  it("wraps a new user's data key under the configured version once it moves on", async () => {
    const { newVersion } = await enabledRotationPair();
    const { createTestUser, consoleAt } = setup();
    const user = await createTestUser();

    const afterRotation = consoleAt(newVersion);
    await afterRotation.warmSealingKey();
    const row = await afterRotation.dataKeyService.ensureDataKey(user.id);

    expect(row.wrappedByKid).toBe(`${KEY}.v${newVersion}`);
    expect(decodeProtectedHeader(row.wrappedKey).kid).toBe(`${KEY}.v${newVersion}`);
  });

  it("accepts a seal a client made against the older version's published key", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { createTestUser, consoleAt, sealFor } = setup();
    const user = await createTestUser();
    const secrets = { DB_URL: `postgres://app:${randomUUID()}@db.internal/app` };

    const seal = await sealFor(user, secrets, { kid: `${KEY}.v${oldVersion}`, publicKey: await publicKeyOf(oldVersion) });

    await expect(consoleAt(newVersion).openSeal(user, seal)).resolves.toEqual(secrets);
  });

  it("refuses a seal naming a crypto key that is not the console's, without reaching the key service", async () => {
    const { newVersion: version } = await enabledRotationPair();
    const { createTestUser, consoleAt, sealFor } = setup();
    const user = await createTestUser();
    const asymmetricDecrypt = vi.spyOn(kmsClient, "asymmetricDecrypt");

    const seal = await sealFor(user, { TOKEN: "t" }, { kid: "other-key.v1", publicKey: await publicKeyOf(version) });

    await expect(consoleAt(version).openSeal(user, seal)).rejects.toMatchObject({ status: 409 });
    expect(asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("cannot open a wrap made under one version with another, so the versions are not one key", async () => {
    const { oldVersion, newVersion } = await enabledRotationPair();
    const { createTestUser, consoleAt } = setup();
    const user = await createTestUser();

    const beforeRotation = consoleAt(oldVersion);
    await beforeRotation.warmSealingKey();
    const row = await beforeRotation.dataKeyService.ensureDataKey(user.id);

    const openedUnderTheWrongVersion = beforeRotation.wrappedJwe.open(beforeRotation.wrappedJwe.parse(row.wrappedKey), versionPath(newVersion));

    await expect(openedUnderTheWrongVersion).rejects.toThrow();
  });

  it("fails closed once the version a stored data key names is disabled", async () => {
    const retiredVersion = await createEnabledVersion();
    const { createTestUser, consoleAt } = setup();
    const user = await createTestUser();

    const consoleApi = consoleAt(retiredVersion);
    await consoleApi.warmSealingKey();
    await consoleApi.dataKeyService.ensureDataKey(user.id);
    await expect(consoleApi.unwrapFor(user.id)).resolves.toHaveLength(32);

    await disableVersion(retiredVersion);

    await expect(consoleApi.unwrapFor(user.id)).rejects.toMatchObject({ status: 503 });
  });

  const pendingCleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(pendingCleanups.splice(0).map(async runCleanup => await runCleanup()));
  });

  function setup() {
    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const userRepository = container.resolve(UserRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const authService = mock<AuthService>();
    const createdUserIds: string[] = [];

    pendingCleanups.push(async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    });

    const consoleAt = (version: string) => {
      const target = createSdlSecretsKmsTarget({ client: kmsClient, versionPath, key: KEY, version });
      const wrappedJwe = new KmsWrappedJweService(target);
      const sealingKeyService = new SdlSecretsSealingKeyService(target, createLogger);
      const dataKeyService = new DataKeyService(dataKeyRepository, sealingKeyService, createLogger);
      const unwrapper = new DataKeyUnwrapperService(dataKeyService, executionContextService, wrappedJwe, target, createLogger);
      const unsealer = new SdlSecretsUnsealerService(target, wrappedJwe, authService, createLogger);

      return {
        target,
        wrappedJwe,
        dataKeyService,
        warmSealingKey: async () => await sealingKeyService.getSealingKey(),
        unwrapFor: async (userId: string) =>
          await executionContextService.runWithContext(async () => await (await unwrapper.getDataKey(userId)).unwrap()),
        openSeal: async (user: UserOutput, seal: string) =>
          await executionContextService.runWithContext(async () => {
            authService.currentUser = user;

            return await unsealer.open({ seal, sdl: SDL });
          })
      };
    };

    async function createTestUser() {
      const user = await userRepository.create({});
      createdUserIds.push(user.id);

      return user;
    }

    const sealFor = async (user: UserOutput, secrets: Record<string, string>, sealedWith: { kid: string; publicKey: ReturnType<typeof createPublicKey> }) =>
      await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(secrets)))
        .setProtectedHeader({
          alg: "RSA-OAEP-256",
          enc: "A256GCM",
          kid: sealedWith.kid,
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 300
        } as never)
        .encrypt(sealedWith.publicKey);

    return { createTestUser, consoleAt, sealFor };
  }
});
