import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { CompactEncrypt, importJWK } from "jose";
import { constants, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import { SDL_SECRETS_MAX_SEAL_LIFETIME_MS } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import type { UserOutput } from "@src/user/repositories";
import { SdlSecretsUnsealerService } from "./sdl-secrets-unsealer.service";

const KID = "sdl-secrets.v1";
const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
const SUBJECT = "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11";

describe(SdlSecretsUnsealerService.name, () => {
  it("returns the secrets a client sealed with a standard JOSE library", async () => {
    const { service, seal } = setup();

    const secrets = await service.open(await seal({ DB_URL: "postgres://app:hunter2@db.internal/app", API_TOKEN: "ghp_x" }));

    expect(secrets).toEqual({ DB_URL: "postgres://app:hunter2@db.internal/app", API_TOKEN: "ghp_x" });
  });

  it("unwraps the content encryption key with the configured crypto key version", async () => {
    const { service, seal, kmsClient } = setup();

    await service.open(await seal({ TOKEN: "t" }));

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledWith(expect.objectContaining({ name: VERSION_NAME }));
  });

  it("rejects a seal made for another user", async () => {
    const { service, seal } = setup();

    await expect(service.open(await seal({ TOKEN: "t" }, { sub: "6d0b1f4c-2222-4444-8888-1a2b3c4d5e6f" }))).rejects.toMatchObject({ status: 403 });
  });

  it("rejects an expired seal", async () => {
    const { service, seal } = setup();

    await expect(service.open(await seal({ TOKEN: "t" }, { exp: Math.floor(Date.now() / 1000) - 1 }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a seal that expires further out than the maximum seal lifetime", async () => {
    const { service, seal, kmsClient } = setup();
    const beyondMaxLifetime = Math.floor((Date.now() + SDL_SECRETS_MAX_SEAL_LIFETIME_MS) / 1000) + 60;

    await expect(service.open(await seal({ TOKEN: "t" }, { exp: beyondMaxLifetime }))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal carrying no expiry", async () => {
    const { service, seal } = setup();

    await expect(service.open(await seal({ TOKEN: "t" }, { exp: undefined }))).rejects.toMatchObject({ status: 400 });
  });

  it("reports a seal made for a key the console no longer holds as a conflict so clients refetch", async () => {
    const { service, seal } = setup();

    await expect(service.open(await seal({ TOKEN: "t" }, { kid: "sdl-secrets.v9" }))).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a content encryption the console does not accept", async () => {
    const { service, seal } = setup();

    await expect(service.open(await seal({ TOKEN: "t" }, { enc: "A128GCM" }))).rejects.toMatchObject({ status: 400 });
  });

  it("does not call KMS when the header is unacceptable", async () => {
    const { service, seal, kmsClient } = setup();

    await expect(service.open(await seal({ TOKEN: "t" }, { exp: 1 }))).rejects.toThrow();

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose claims were altered after sealing", async () => {
    const { service, seal } = setup();
    const [protectedHeader, ...rest] = (await seal({ TOKEN: "t" })).split(".");
    const claims = JSON.parse(Buffer.from(protectedHeader, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 86400 })).toString("base64url");

    await expect(service.open([forged, ...rest].join("."))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a seal whose ciphertext was altered after sealing", async () => {
    const { service, seal } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");

    await expect(service.open(parts.join("."))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects anything that is not a compact JWE", async () => {
    const { service } = setup();

    await expect(service.open("not.a.jwe")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a payload that is not a flat object of strings", async () => {
    const { service, seal } = setup();

    await expect(service.open(await seal({ nested: { deep: "value" } }))).rejects.toMatchObject({ status: 400 });
  });

  it("fails with 503 when KMS is unreachable", async () => {
    const { service, seal, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockRejectedValue(new Error("14 UNAVAILABLE"));

    await expect(service.open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 503 });
  });

  it("fails with 503 when KMS reports a corrupted request", async () => {
    const { service, seal, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockResolvedValue([{ plaintext: Buffer.alloc(32), verifiedCiphertextCrc32c: false }]);

    await expect(service.open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 503 });
  });

  function setup() {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
    const jwk = { ...publicKey.export({ format: "jwk" }), use: "enc", alg: "RSA-OAEP-256" };

    const seal = async (secrets: unknown, claims?: Record<string, unknown>) => {
      const header = { alg: "RSA-OAEP-256", enc: "A256GCM", kid: KID, sub: SUBJECT, exp: Math.floor(Date.now() / 1000) + 300, ...claims };

      return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(secrets)))
        .setProtectedHeader(header as never)
        .encrypt(await importJWK(jwk, "RSA-OAEP-256"));
    };

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

    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: SUBJECT }) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const kmsTarget = { client: kmsClient, versionName: VERSION_NAME, kid: KID };
    const service = new SdlSecretsUnsealerService(kmsTarget, authService, createLogger);

    return { service, kmsClient, authService, logger, seal };
  }
});
