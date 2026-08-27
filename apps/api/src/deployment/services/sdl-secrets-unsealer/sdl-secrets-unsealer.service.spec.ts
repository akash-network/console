import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { grpc } from "google-gax";
import { compactDecrypt, CompactEncrypt, importJWK } from "jose";
import { constants, createCipheriv, createHash, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import { SDL_SECRETS_MAX_SEAL_LIFETIME_MS } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { UserOutput } from "@src/user/repositories";
import { SdlSecretsUnsealerService } from "./sdl-secrets-unsealer.service";

const KID = "sdl-secrets.v1";
const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
const SUBJECT = "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11";
const SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n';

function sdlHashOf(sdl: string) {
  return createHash("sha256").update(sdl, "utf8").digest("base64url");
}

function sealClaims(claims?: Record<string, unknown>) {
  return { alg: "RSA-OAEP-256", enc: "A256GCM", kid: KID, sub: SUBJECT, exp: Math.floor(Date.now() / 1000) + 300, ...claims };
}

describe(SdlSecretsUnsealerService.name, () => {
  it("returns the secrets a client sealed with a standard JOSE library", async () => {
    const { open, seal, clientSecrets } = setup();

    const secrets = await open(await seal(clientSecrets));

    expect(secrets).toEqual(clientSecrets);
  });

  it("unwraps the content encryption key with the configured crypto key version", async () => {
    const { open, seal, kmsClient } = setup();

    await open(await seal({ TOKEN: "t" }));

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledWith(expect.objectContaining({ name: VERSION_NAME }));
  });

  it("rejects a seal made for another user", async () => {
    const { open, seal } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { sub: "6d0b1f4c-2222-4444-8888-1a2b3c4d5e6f" }))).rejects.toMatchObject({ status: 403 });
  });

  it("rejects an expired seal", async () => {
    const { open, seal } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { exp: Math.floor(Date.now() / 1000) - 1 }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a seal that expires further out than the maximum seal lifetime", async () => {
    const { open, seal, kmsClient } = setup();
    const beyondMaxLifetime = Math.floor((Date.now() + SDL_SECRETS_MAX_SEAL_LIFETIME_MS) / 1000) + 60;

    await expect(open(await seal({ TOKEN: "t" }, { exp: beyondMaxLifetime }))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal carrying no expiry", async () => {
    const { open, seal } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { exp: undefined }))).rejects.toMatchObject({ status: 400 });
  });

  it("reports a seal made for a key the console no longer holds as a conflict so clients refetch", async () => {
    const { open, seal } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { kid: "sdl-secrets.v9" }))).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a content encryption the console does not accept", async () => {
    const { open, seal } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { enc: "A128GCM" }))).rejects.toMatchObject({ status: 400 });
  });

  it("opens a seal carrying no SDL binding and records the open as unbound", async () => {
    const { open, seal, clientSecrets, logger } = setup();

    await expect(open(await seal(clientSecrets))).resolves.toEqual(clientSecrets);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "SDL_SECRETS_SEAL_OPENED", sdlBound: false }));
  });

  it("opens a seal bound to the SDL it was sealed against and records the open as bound", async () => {
    const { open, seal, clientSecrets, logger } = setup();

    await expect(open(await seal(clientSecrets, { sdlHash: sdlHashOf(SDL) }))).resolves.toEqual(clientSecrets);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "SDL_SECRETS_SEAL_OPENED", sdlBound: true }));
  });

  it("rejects a seal bound to a different SDL without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const sealedAgainstAnotherSdl = await seal({ TOKEN: "t" }, { sdlHash: sdlHashOf('version: "2.0"\nservices:\n  web:\n    image: attacker\n') });

    await expect(open(sealedAgainstAnotherSdl, SDL)).rejects.toMatchObject({ status: 403 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose SDL binding is not a base64url digest", async () => {
    const { open, seal, kmsClient } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { sdlHash: 42 }))).rejects.toMatchObject({ status: 403 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose SDL binding was stripped after sealing", async () => {
    const { open, seal } = setup();
    const [protectedHeader, ...rest] = (await seal({ TOKEN: "t" }, { sdlHash: sdlHashOf(SDL) })).split(".");
    const { sdlHash, ...claimsWithoutBinding } = JSON.parse(Buffer.from(protectedHeader, "base64url").toString());
    const stripped = Buffer.from(JSON.stringify(claimsWithoutBinding)).toString("base64url");

    await expect(open([stripped, ...rest].join("."))).rejects.toMatchObject({ status: 400 });
    expect(sdlHash).toEqual(sdlHashOf(SDL));
  });

  it("assembles a seal jose opens, so the decoder's wire format is not private to it", async () => {
    const { assembleSeal, privateKey, clientSecrets } = setup();

    const { plaintext } = await compactDecrypt(assembleSeal(clientSecrets), privateKey);

    expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual(clientSecrets);
  });

  it("opens a seal assembled from the same primitives and AAD convention it decodes with", async () => {
    const { open, assembleSeal, clientSecrets } = setup();

    await expect(open(assembleSeal(clientSecrets))).resolves.toEqual(clientSecrets);
  });

  it("opens a hand-assembled seal bound to the SDL it was assembled against", async () => {
    const { open, assembleSeal, clientSecrets } = setup();

    await expect(open(assembleSeal(clientSecrets, { sdlHash: sdlHashOf(SDL) }))).resolves.toEqual(clientSecrets);
  });

  it("does not call KMS when the header is unacceptable", async () => {
    const { open, seal, kmsClient } = setup();

    await expect(open(await seal({ TOKEN: "t" }, { exp: 1 }))).rejects.toThrow();

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose claims were altered after sealing", async () => {
    const { open, seal, kmsClient } = setup();
    const [protectedHeader, ...rest] = (await seal({ TOKEN: "t" })).split(".");
    const claims = JSON.parse(Buffer.from(protectedHeader, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp - 1 })).toString("base64url");

    await expect(open([forged, ...rest].join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalled();
  });

  it("rejects a seal whose ciphertext was altered after sealing", async () => {
    const { open, seal } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a seal whose protected header is the JSON literal null", async () => {
    const { open, seal, kmsClient } = setup();
    const [, ...rest] = (await seal({ TOKEN: "t" })).split(".");

    await expect(open([Buffer.from("null").toString("base64url"), ...rest].join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose protected header is a JSON array", async () => {
    const { open, seal } = setup();
    const [, ...rest] = (await seal({ TOKEN: "t" })).split(".");

    await expect(open([Buffer.from("[]").toString("base64url"), ...rest].join("."))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a seal whose content encryption key is not the length AES-256 requires", async () => {
    const { open, seal, kmsClient } = setup();
    const shortKey = Buffer.alloc(16);
    kmsClient.asymmetricDecrypt.mockResolvedValue([
      { plaintext: shortKey, plaintextCrc32c: { value: String(crc32c.calculate(shortKey)) }, verifiedCiphertextCrc32c: true }
    ]);

    await expect(open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects anything that is not a compact JWE", async () => {
    const { open } = setup();

    await expect(open("not.a.jwe")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a payload that is not a flat object of strings", async () => {
    const { open, seal } = setup();

    await expect(open(await seal({ nested: { deep: "value" } }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a payload that is not JSON at all as an invalid payload rather than a tampered seal", async () => {
    const { open, sealRaw, logger } = setup();

    await expect(open(await sealRaw("not json at all"))).rejects.toMatchObject({ status: 400 });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "SDL_SECRETS_SEAL_PAYLOAD_INVALID" }));
  });

  it("reports a genuinely altered ciphertext as a tampered seal rather than an invalid payload", async () => {
    const { open, seal, logger } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "SDL_SECRETS_SEAL_TAMPERED" }));
  });

  it("fails with 503 when KMS is unreachable", async () => {
    const { open, seal, kmsClient, logger } = setup();
    kmsClient.asymmetricDecrypt.mockRejectedValue(Object.assign(new Error("14 UNAVAILABLE"), { code: grpc.status.UNAVAILABLE }));

    await expect(open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 503 });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SDL_SECRETS_CEK_UNWRAP_FAILED" }));
  });

  it("rejects a seal whose initialization vector is empty without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[2] = "";

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose initialization vector is not the 96 bits A256GCM fixes", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[2] = randomBytes(13).toString("base64url");

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose initialization vector is not base64url", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[2] = `${randomBytes(12).toString("base64url")}!!!!`;

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose protected header is not base64url without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[0] = `${parts[0]}!`;

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose ciphertext is not base64url without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[3] = `${parts[3]}!!!!`;

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose encrypted key carries one base64url character too many without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[1] = `${parts[1]}A`;

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose initialization vector carries one base64url character too many without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[2] = `${parts[2]}A`;

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal carrying no encrypted key without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[1] = "";

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose encrypted key is not base64url without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[1] = `${parts[1]}!!!!`;

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose encrypted key is not the length the sealing key's modulus fixes without spending an unwrap", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[1] = randomBytes(200).toString("base64url");

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("blames the client when KMS rejects the encrypted key as an invalid argument", async () => {
    const { open, seal, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockRejectedValue(Object.assign(new Error("3 INVALID_ARGUMENT: Decryption failed"), { code: grpc.status.INVALID_ARGUMENT }));

    await expect(open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 400 });
  });

  it("does not log a KMS invalid argument as a service fault", async () => {
    const { open, seal, kmsClient, logger } = setup();
    kmsClient.asymmetricDecrypt.mockRejectedValue(Object.assign(new Error("3 INVALID_ARGUMENT: Decryption failed"), { code: grpc.status.INVALID_ARGUMENT }));

    await expect(open(await seal({ TOKEN: "t" }))).rejects.toThrow();

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "SDL_SECRETS_SEAL_ENCRYPTED_KEY_REJECTED" }));
  });

  it("rejects a seal whose authentication tag is not a length AES-GCM accepts", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[4] = Buffer.alloc(5).toString("base64url");

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects a seal whose authentication tag was truncated to a length AES-GCM accepts", async () => {
    const { open, seal, kmsClient } = setup();
    const parts = (await seal({ TOKEN: "t" })).split(".");
    parts[4] = Buffer.from(parts[4], "base64url").subarray(0, 4).toString("base64url");

    await expect(open(parts.join("."))).rejects.toMatchObject({ status: 400 });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("fails with 503 when KMS returns no plaintext", async () => {
    const { open, seal, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockResolvedValue([{ verifiedCiphertextCrc32c: true }]);

    await expect(open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 503 });
  });

  it("fails with 503 when KMS reports a corrupted request", async () => {
    const { open, seal, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockResolvedValue([{ plaintext: Buffer.alloc(32), verifiedCiphertextCrc32c: false }]);

    await expect(open(await seal({ TOKEN: "t" }))).rejects.toMatchObject({ status: 503 });
  });

  function setup() {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
    const jwk = { ...publicKey.export({ format: "jwk" }), use: "enc", alg: "RSA-OAEP-256" };
    const clientSecrets = { DB_URL: `postgres://app:${randomUUID()}@db.internal/app`, API_TOKEN: randomBytes(20).toString("hex") };

    const sealRaw = async (plaintext: string, claims?: Record<string, unknown>) =>
      new CompactEncrypt(new TextEncoder().encode(plaintext)).setProtectedHeader(sealClaims(claims) as never).encrypt(await importJWK(jwk, "RSA-OAEP-256"));

    const seal = async (secrets: unknown, claims?: Record<string, unknown>) => await sealRaw(JSON.stringify(secrets), claims);

    /**
     * Builds a compact JWE from the same stock primitives and AAD convention the service decodes
     * with. The console only ever opens seals, so there is no production producer to test against;
     * this is the closest honest reverse direction, and it fails whichever way a base64url,
     * AAD-encoding or OAEP-digest divergence exists.
     */
    const assembleSeal = (secrets: unknown, claims?: Record<string, unknown>) => {
      const protectedHeader = Buffer.from(JSON.stringify(sealClaims(claims))).toString("base64url");
      const contentEncryptionKey = randomBytes(32);
      const encryptedKey = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, contentEncryptionKey);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", contentEncryptionKey, iv);
      cipher.setAAD(Buffer.from(protectedHeader, "ascii"));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secrets), "utf8"), cipher.final()]);

      return [
        protectedHeader,
        encryptedKey.toString("base64url"),
        iv.toString("base64url"),
        ciphertext.toString("base64url"),
        cipher.getAuthTag().toString("base64url")
      ].join(".");
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
    const service = new SdlSecretsUnsealerService(kmsTarget, new KmsWrappedJweService(kmsTarget), authService, createLogger);
    const open = (seal: string, sdl = SDL) => service.open({ seal, sdl });

    return { open, kmsClient, authService, logger, seal, sealRaw, assembleSeal, privateKey, clientSecrets };
  }
});
