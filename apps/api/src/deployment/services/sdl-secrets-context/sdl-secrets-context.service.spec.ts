import { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import type { UserOutput } from "@src/user/repositories";
import type { SdlSecretsPublicJwk } from "./sdl-secrets-context.service";
import { SdlSecretsContextService } from "./sdl-secrets-context.service";

describe(SdlSecretsContextService.name, () => {
  it("returns the KMS public key as an RSA-OAEP-256 encryption JWK", async () => {
    const { service, pem } = setup();

    const context = await service.getContext();

    expect(context.jwk).toEqual({
      kty: "RSA",
      n: expect.any(String),
      e: "AQAB",
      use: "enc",
      alg: "RSA-OAEP-256"
    });
    expect(asSpkiPem(context.jwk)).toBe(pem);
  });

  it("returns the kid of the crypto key version the seal must name", async () => {
    const { service } = setup({ kid: "sdl-secrets.v7" });

    const context = await service.getContext();

    expect(context.kid).toBe("sdl-secrets.v7");
  });

  it("returns the internal user id as the subject rather than the external user id", async () => {
    const { service } = setup({ currentUser: mock<UserOutput>({ id: "8b1e0e6e-0f3f-4b2a-9c31-6b1b0d2a4c55", userId: "auth0|external" }) });

    const context = await service.getContext();

    expect(context.sub).toBe("8b1e0e6e-0f3f-4b2a-9c31-6b1b0d2a4c55");
  });

  it("advertises the claims a client must put in the seal's protected header", async () => {
    const { service } = setup();

    const context = await service.getContext();

    expect(context.requiredClaims).toEqual(["kid", "sub", "exp"]);
  });

  it("fetches the public key once and serves later calls from memory", async () => {
    const { service, kmsClient } = setup();

    await service.getContext();
    await service.getContext();

    expect(kmsClient.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it("asks KMS for the configured crypto key version", async () => {
    const { service, kmsClient } = setup({ versionName: "projects/p/locations/global/keyRings/r/cryptoKeys/k/cryptoKeyVersions/1" });

    await service.getContext();

    expect(kmsClient.getPublicKey).toHaveBeenCalledWith({ name: "projects/p/locations/global/keyRings/r/cryptoKeys/k/cryptoKeyVersions/1" });
  });

  it("fails with 503 when KMS is unreachable", async () => {
    const { service, kmsClient } = setup();
    kmsClient.getPublicKey.mockRejectedValue(new Error("14 UNAVAILABLE"));

    await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
  });

  it("retries the fetch after a failure instead of caching it", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));

    await expect(service.getContext()).rejects.toThrow();
    kmsClient.getPublicKey.mockResolvedValue([publicKeyResponse]);

    await expect(service.getContext()).resolves.toMatchObject({ kid: "sdl-secrets.v1" });
  });

  it("rejects a public key whose checksum does not match its PEM", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, pemCrc32c: { value: "1" } }]);

    await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
  });

  it("rejects a public key that belongs to another crypto key version", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, name: "projects/p/other" }]);

    await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
  });

  it("rejects a response carrying no PEM", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, pem: "" }]);

    await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
  });

  it("rejects a key that cannot perform RSA-OAEP-256", async () => {
    const ellipticCurvePem = generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ type: "spki", format: "pem" }).toString();
    const { service } = setup({ pem: ellipticCurvePem });

    await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
  });

  it.each(["RSA_DECRYPT_OAEP_3072_SHA1", "RSA_DECRYPT_OAEP_4096_SHA512", "RSA_SIGN_PKCS1_3072_SHA256", null] as const)(
    "rejects a key version provisioned as %s rather than for RSA-OAEP-256",
    async algorithm => {
      const { service, kmsClient, publicKeyResponse } = setup();
      kmsClient.getPublicKey.mockResolvedValue([{ ...publicKeyResponse, algorithm }]);

      await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
    }
  );

  it("accepts an algorithm reported as an enum ordinal rather than a name", async () => {
    const { service, kmsClient, publicKeyResponse } = setup();
    kmsClient.getPublicKey.mockResolvedValue([
      { ...publicKeyResponse, algorithm: protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionAlgorithm.RSA_DECRYPT_OAEP_3072_SHA256 }
    ]);

    await expect(service.getContext()).resolves.toMatchObject({ jwk: expect.objectContaining({ alg: "RSA-OAEP-256" }) });
  });

  function asSpkiPem(jwk: SdlSecretsPublicJwk) {
    return createPublicKey({ key: { ...jwk }, format: "jwk" })
      .export({ type: "spki", format: "pem" })
      .toString();
  }

  function setup(input?: { pem?: string; kid?: string; versionName?: string; currentUser?: UserOutput }) {
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

    const authService = mock<AuthService>({
      currentUser: input?.currentUser ?? mock<UserOutput>({ id: "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11" })
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;
    const kmsTarget = { client: kmsClient, versionName, kid: input?.kid ?? "sdl-secrets.v1" };
    const service = new SdlSecretsContextService(kmsTarget, authService, createLogger);

    return { service, kmsClient, authService, logger, pem, versionName, publicKeyResponse };
  }
});
