import { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import type { SdlSecretsPublicJwk } from "./sdl-secrets-sealing-key.service";
import { SdlSecretsSealingKeyService } from "./sdl-secrets-sealing-key.service";

describe(SdlSecretsSealingKeyService.name, () => {
  it("returns the KMS public key as an RSA-OAEP-256 encryption JWK", async () => {
    const { service, pem } = setup();

    const { jwk } = await service.getSealingKey();

    expect(jwk).toEqual({
      kty: "RSA",
      n: expect.any(String),
      e: "AQAB",
      use: "enc",
      alg: "RSA-OAEP-256"
    });
    expect(asSpkiPem(jwk)).toBe(pem);
  });

  it("returns the public key as a key object wrapping can encrypt with", async () => {
    const { service, pem } = setup();

    const { publicKey } = await service.getSealingKey();

    expect(publicKey.export({ type: "spki", format: "pem" }).toString()).toBe(pem);
  });

  it("returns the kid of the crypto key version the seal must name", async () => {
    const { service } = setup({ kid: "sdl-secrets.v7" });

    const { kid } = await service.getSealingKey();

    expect(kid).toBe("sdl-secrets.v7");
  });

  it("fetches the public key once and serves later calls from memory", async () => {
    const { service, kmsClient } = setup();

    await service.getSealingKey();
    await service.getSealingKey();

    expect(kmsClient.getPublicKey).toHaveBeenCalledTimes(1);
  });

  describe("peekSealingKey", () => {
    it("returns nothing while the key has not been fetched yet", () => {
      const { service } = setup();

      expect(service.peekSealingKey()).toBeUndefined();
    });

    it("returns the key once it is held", async () => {
      const { service } = setup({ kid: "sdl-secrets.v2" });
      await service.getSealingKey();

      expect(service.peekSealingKey()).toMatchObject({ kid: "sdl-secrets.v2" });
    });

    it("starts a fetch so a later peek finds the key", async () => {
      const { service, kmsClient } = setup();

      expect(service.peekSealingKey()).toBeUndefined();

      await vi.waitFor(() => expect(service.peekSealingKey()).toMatchObject({ kid: "sdl-secrets.v1" }));

      expect(kmsClient.getPublicKey).toHaveBeenCalledTimes(1);
    });

    it("swallows a failed fetch it started instead of rejecting the caller", async () => {
      const { service, kmsClient } = setup();
      kmsClient.getPublicKey.mockRejectedValue(new Error("14 UNAVAILABLE"));

      expect(service.peekSealingKey()).toBeUndefined();
      await vi.waitFor(() => expect(kmsClient.getPublicKey).toHaveBeenCalled());

      expect(service.peekSealingKey()).toBeUndefined();
    });
  });

  it("asks KMS for the configured crypto key version", async () => {
    const { service, kmsClient } = setup({ versionName: "projects/p/locations/global/keyRings/r/cryptoKeys/k/cryptoKeyVersions/1" });

    await service.getSealingKey();

    expect(kmsClient.getPublicKey).toHaveBeenCalledWith({ name: "projects/p/locations/global/keyRings/r/cryptoKeys/k/cryptoKeyVersions/1" });
  });

  it("fails with 503 when KMS is unreachable", async () => {
    const { service, kmsClient } = setup();
    kmsClient.getPublicKey.mockRejectedValue(new Error("14 UNAVAILABLE"));

    await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
  });

  it("retries the fetch after a failure instead of caching it", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));

    await expect(service.getSealingKey()).rejects.toThrow();
    kmsClient.getPublicKey.mockResolvedValue([publicKeyResponse]);

    await expect(service.getSealingKey()).resolves.toMatchObject({ kid: "sdl-secrets.v1" });
  });

  it("rejects a public key whose checksum does not match its PEM", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, pemCrc32c: { value: "1" } }]);

    await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
  });

  it("rejects a public key that belongs to another crypto key version", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, name: "projects/p/other" }]);

    await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
  });

  it("rejects a response carrying no PEM", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, pem: "" }]);

    await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
  });

  it("rejects a key that cannot perform RSA-OAEP-256", async () => {
    const ellipticCurvePem = generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ type: "spki", format: "pem" }).toString();
    const { service } = setup({ pem: ellipticCurvePem });

    await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
  });

  it("rejects a PEM that cannot be parsed as a public key", async () => {
    const { service } = setup({ pem: "-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n" });

    await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
  });

  it.each(["RSA_DECRYPT_OAEP_3072_SHA1", "RSA_DECRYPT_OAEP_4096_SHA512", "RSA_SIGN_PKCS1_3072_SHA256", null] as const)(
    "rejects a key version provisioned as %s rather than for RSA-OAEP-256",
    async algorithm => {
      const { service, kmsClient, publicKeyResponse } = setup();
      kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, algorithm }]);

      await expect(service.getSealingKey()).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });
    }
  );

  it("accepts an algorithm reported as an enum ordinal rather than a name", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([
      { ...publicKeyResponse, algorithm: protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionAlgorithm.RSA_DECRYPT_OAEP_3072_SHA256 }
    ]);

    await expect(service.getSealingKey()).resolves.toMatchObject({ jwk: expect.objectContaining({ alg: "RSA-OAEP-256" }) });
  });

  function asSpkiPem(jwk: SdlSecretsPublicJwk) {
    return createPublicKey({ key: { ...jwk }, format: "jwk" })
      .export({ type: "spki", format: "pem" })
      .toString();
  }

  function setup(input?: { pem?: string; kid?: string; versionName?: string }) {
    const pem = input?.pem ?? generateKeyPairSync("rsa", { modulusLength: 3072 }).publicKey.export({ type: "spki", format: "pem" }).toString();
    const versionName = input?.versionName ?? "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
    const publicKeyResponse: protos.google.cloud.kms.v1.IPublicKey = {
      pem,
      name: versionName,
      algorithm: "RSA_DECRYPT_OAEP_3072_SHA256",
      pemCrc32c: { value: String(crc32c.calculate(pem)) }
    };

    const kmsClient = mock<SdlSecretsKmsClient>();
    kmsClient.getPublicKey.mockResolvedValue([publicKeyResponse]);

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;
    const kmsTarget = { client: kmsClient, versionName, kid: input?.kid ?? "sdl-secrets.v1" };
    const service = new SdlSecretsSealingKeyService(kmsTarget, createLogger);

    return { service, kmsClient, logger, pem, versionName, publicKeyResponse };
  }
});
