import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { SdlSecretsSealingKey, SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { UserOutput } from "@src/user/repositories";
import { SdlSecretsContextService } from "./sdl-secrets-context.service";

describe(SdlSecretsContextService.name, () => {
  it("publishes the sealing key as the JWK a client encrypts to", async () => {
    const { service, sealingKey } = setup();

    const context = await service.getContext();

    expect(context.jwk).toBe(sealingKey.jwk);
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

  it("propagates the failure when the sealing key cannot be verified", async () => {
    const { service, sealingKeyService } = setup();
    sealingKeyService.getSealingKey.mockRejectedValue(Object.assign(new Error("unverifiable"), { status: 503 }));

    await expect(service.getContext()).rejects.toMatchObject({ status: 503 });
  });

  function setup(input?: { kid?: string; currentUser?: UserOutput }) {
    const sealingKey: SdlSecretsSealingKey = {
      kid: input?.kid ?? "sdl-secrets.v1",
      publicKey: generateKeyPairSync("rsa", { modulusLength: 3072 }).publicKey,
      jwk: { kty: "RSA", n: "modulus", e: "AQAB", use: "enc", alg: "RSA-OAEP-256" }
    };
    const sealingKeyService = mock<SdlSecretsSealingKeyService>();
    sealingKeyService.getSealingKey.mockResolvedValue(sealingKey);

    const authService = mock<AuthService>({
      currentUser: input?.currentUser ?? mock<UserOutput>({ id: "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11" })
    });

    const service = new SdlSecretsContextService(sealingKeyService, authService);

    return { service, sealingKeyService, authService, sealingKey };
  }
});
