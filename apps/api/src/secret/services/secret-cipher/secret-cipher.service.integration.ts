import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { compactDecrypt, CompactEncrypt, decodeProtectedHeader } from "jose";
import { constants, generateKeyPairSync, privateDecrypt, randomBytes, randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { SecretCipherService } from "./secret-cipher.service";

const KID = "sdl-secrets.v1";
const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
const SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n';

describe(SecretCipherService.name, () => {
  it("returns the exact values a client sealed after they have been encrypted at rest and decrypted back", async () => {
    const { cipher, openSeal, sealAs, createTestUser, inRequest } = setup();
    const user = await createTestUser();
    const clientSecrets = {
      DB_URL: `postgres://app:${randomUUID()}@db.internal/app`,
      API_TOKEN: randomBytes(20).toString("hex"),
      PRIVATE_KEY: "-----BEGIN KEY-----\nдані 🔐\n-----END KEY-----\n",
      EMPTY: ""
    };

    const roundTripped = await inRequest(user, async () => {
      const opened = await openSeal(await sealAs(user, clientSecrets));
      const stored = await Promise.all(Object.entries(opened).map(async ([name, value]) => [name, await cipher.encrypt(user.id, value)] as const));

      return Object.fromEntries(await Promise.all(stored.map(async ([name, encrypted]) => [name, await cipher.decrypt(user.id, encrypted)] as const)));
    });

    expect(roundTripped).toEqual(clientSecrets);
  });

  it("records the user's own data key record in every value it stores", async () => {
    const { cipher, createTestUser, inRequest, dataKeyRepository } = setup();
    const user = await createTestUser();

    const stored = await inRequest(user, async () => await Promise.all(["a", "b", "c"].map(async value => await cipher.encrypt(user.id, value))));
    const dataKey = await dataKeyRepository.findByUserId(user.id);

    expect(stored.map(encrypted => decodeProtectedHeader(encrypted).kid)).toEqual([dataKey!.id, dataKey!.id, dataKey!.id]);
    expect(stored.map(encrypted => decodeProtectedHeader(encrypted).alg)).toEqual(["dir", "dir", "dir"]);
  });

  it("unwraps the data key once for a request that encrypts and decrypts twelve values", async () => {
    const { cipher, createTestUser, inRequest, kmsClient } = setup();
    const user = await createTestUser();
    const values = Array.from({ length: 12 }, (_, index) => `secret-${index}`);

    const roundTripped = await inRequest(user, async () => {
      const stored = await Promise.all(values.map(async value => await cipher.encrypt(user.id, value)));

      return await Promise.all(stored.map(async encrypted => await cipher.decrypt(user.id, encrypted)));
    });

    expect(roundTripped).toEqual(values);
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
  });

  it("unwraps the data key again in the request that follows the one that unwrapped it", async () => {
    const { cipher, createTestUser, inRequest, kmsClient } = setup();
    const user = await createTestUser();

    const encrypted = await inRequest(user, async () => await cipher.encrypt(user.id, "value"));

    await expect(inRequest(user, async () => await cipher.decrypt(user.id, encrypted))).resolves.toBe("value");
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
  });

  it("holds no data key once the request that unwrapped one has ended", async () => {
    const { cipher, createTestUser, inRequest, executionContextService } = setup();
    const user = await createTestUser();

    const heldDuringRequest = await inRequest(user, async () => {
      await cipher.encrypt(user.id, "value");

      return executionContextService.get("HELD_DATA_KEYS");
    });
    const heldInNextRequest = await inRequest(user, async () => executionContextService.get("HELD_DATA_KEYS"));

    expect(heldDuringRequest?.size).toBe(1);
    expect(heldInNextRequest).toBeUndefined();
  });

  it("refuses to decrypt one user's stored value for another user", async () => {
    const { cipher, createTestUser, inRequest } = setup();
    const [owner, other] = await Promise.all([createTestUser(), createTestUser()]);

    const encryptedForOwner = await inRequest(owner, async () => await cipher.encrypt(owner.id, "owner-only"));

    await expect(inRequest(other, async () => await cipher.decrypt(other.id, encryptedForOwner))).rejects.toMatchObject({ status: 500 });
  });

  it("fails authentication when one user's stored value is opened with another user's data key", async () => {
    const { cipher, createTestUser, inRequest, dataKeyOf } = setup();
    const [owner, other] = await Promise.all([createTestUser(), createTestUser()]);

    const encryptedForOwner = await inRequest(owner, async () => await cipher.encrypt(owner.id, "owner-only"));
    await inRequest(other, async () => await cipher.encrypt(other.id, "other-only"));

    await expect(compactDecrypt(encryptedForOwner, await dataKeyOf(other))).rejects.toMatchObject({ code: "ERR_JWE_DECRYPTION_FAILED" });
    await expect(compactDecrypt(encryptedForOwner, await dataKeyOf(owner))).resolves.toMatchObject({ protectedHeader: { alg: "dir" } });
  });

  it("reads a value back through a service that shares nothing with the one that stored it", async () => {
    const { cipher, buildCipher, createTestUser, inRequest } = setup();
    const user = await createTestUser();

    const encrypted = await inRequest(user, async () => await cipher.encrypt(user.id, "durable"));

    await expect(inRequest(user, async () => await buildCipher().decrypt(user.id, encrypted))).resolves.toBe("durable");
  });

  it("creates the data key row on first use for a user that never had one", async () => {
    const { cipher, createTestUser, inRequest, dataKeyRepository } = setup();
    const user = await createTestUser();

    expect(await dataKeyRepository.findByUserId(user.id)).toBeUndefined();

    await inRequest(user, async () => await cipher.encrypt(user.id, "value"));

    expect(await dataKeyRepository.findByUserId(user.id)).toMatchObject({ userId: user.id, wrappedByKid: KID });
  });

  const pendingCleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(pendingCleanups.splice(0).map(async runCleanup => await runCleanup()));
  });

  function setup() {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
    const { n, e } = publicKey.export({ format: "jwk" });
    const sealingKeyService = mock<SdlSecretsSealingKeyService>();
    sealingKeyService.peekSealingKey.mockReturnValue({ kid: KID, publicKey, jwk: { kty: "RSA", n: n!, e: e!, use: "enc", alg: "RSA-OAEP-256" } });

    const kmsClient = mock<SdlSecretsKmsClient>();
    kmsClient.asymmetricDecrypt.mockImplementation(async request => {
      const plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(request.ciphertext));

      return [
        {
          plaintext,
          plaintextCrc32c: { value: String(crc32c.calculate(plaintext)) },
          verifiedCiphertextCrc32c: true
        } satisfies protos.google.cloud.kms.v1.IAsymmetricDecryptResponse
      ];
    });

    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const kmsTarget = { client: kmsClient, versionName: VERSION_NAME, kid: KID };
    const wrappedJweService = new KmsWrappedJweService(kmsTarget);
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const userRepository = container.resolve(UserRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const dataKeyService = new DataKeyService(dataKeyRepository, sealingKeyService, createLogger);
    const authService = mock<AuthService>();

    const buildCipher = () =>
      new SecretCipherService(new DataKeyUnwrapperService(dataKeyService, executionContextService, wrappedJweService, kmsTarget, createLogger), createLogger);

    const unsealer = new SdlSecretsUnsealerService(kmsTarget, wrappedJweService, authService, createLogger);
    const createdUserIds: string[] = [];

    pendingCleanups.push(async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    });

    async function createTestUser() {
      const user = await userRepository.create({});
      createdUserIds.push(user.id);

      return user;
    }

    const sealAs = async (user: UserOutput, secrets: Record<string, string>) =>
      await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(secrets)))
        .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM", kid: KID, sub: user.id, exp: Math.floor(Date.now() / 1000) + 300 } as never)
        .encrypt(publicKey);

    const openSeal = async (seal: string) => await unsealer.open({ seal, sdl: SDL });

    const inRequest = <R>(user: UserOutput, cb: () => Promise<R>) =>
      executionContextService.runWithContext(async () => {
        authService.currentUser = user;

        return await cb();
      });

    const dataKeyOf = async (user: UserOutput) => {
      const dataKey = await dataKeyRepository.findByUserId(user.id);

      return Buffer.from((await compactDecrypt(dataKey!.wrappedKey, privateKey)).plaintext);
    };

    return {
      cipher: buildCipher(),
      buildCipher,
      openSeal,
      sealAs,
      createTestUser,
      inRequest,
      kmsClient,
      executionContextService,
      dataKeyRepository,
      dataKeyOf
    };
  }
});
