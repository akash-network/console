import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { exportJWK, generateKeyPair, type JWK, type JWTPayload, type KeyLike, SignJWT, UnsecuredJWT } from "jose";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthConfigService } from "../auth-config/auth-config.service";
import { UserAuthTokenService } from "./user-auth-token.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const ISSUER = "https://tenant.example.com/";
const AUDIENCE = "https://console-api.example.com";
const JWKS_PATH = "/.well-known/jwks.json";

describe(UserAuthTokenService.name, () => {
  describe("getValidUserId", () => {
    it("returns the subject of a token issued for this API", async () => {
      const { service, signToken } = await setup();
      const sub = faker.string.uuid();

      expect(await service.getValidUserId(`Bearer ${await signToken({ sub })}`)).toBe(sub);
    });

    it("accepts the bearer scheme in any letter case", async () => {
      const { service, signToken } = await setup();
      const sub = faker.string.uuid();

      expect(await service.getValidUserId(`bearer ${await signToken({ sub })}`)).toBe(sub);
    });

    it("accepts a token whose audience lists this API next to another one", async () => {
      const { service, signToken } = await setup();
      const sub = faker.string.uuid();

      expect(await service.getValidUserId(await signToken({ sub, aud: [AUDIENCE, `${ISSUER}userinfo`] }))).toBe(sub);
    });

    it("accepts a token from any configured issuer for any configured audience", async () => {
      const otherIssuer = "https://auth.example.com/";
      const otherAudience = "https://other-console-api.example.com";
      const { service, signToken } = await setup({ issuers: [ISSUER, otherIssuer], audiences: [AUDIENCE, otherAudience] });
      const sub = faker.string.uuid();

      expect(await service.getValidUserId(await signToken({ sub, iss: otherIssuer, aud: otherAudience }))).toBe(sub);
    });

    it("accepts a token that expired within the clock tolerance", async () => {
      const { service, signToken } = await setup();
      const sub = faker.string.uuid();

      expect(await service.getValidUserId(await signToken({ sub, exp: secondsFromNow(-20) }))).toBe(sub);
    });

    it("accepts a token that becomes valid within the clock tolerance", async () => {
      const { service, signToken } = await setup();
      const sub = faker.string.uuid();

      expect(await service.getValidUserId(await signToken({ sub, nbf: secondsFromNow(20) }))).toBe(sub);
    });

    it.each([
      { description: "expired beyond the clock tolerance", claims: () => ({ exp: secondsFromNow(-40) }) },
      { description: "expired a year ago", claims: () => ({ iat: secondsFromNow(-366 * 86400), exp: secondsFromNow(-365 * 86400) }) },
      { description: "is not valid yet", claims: () => ({ nbf: secondsFromNow(40) }) },
      { description: "has no expiry", claims: () => ({ exp: undefined }) },
      { description: "was issued by another issuer", claims: () => ({ iss: "https://other-tenant.example.com/" }) },
      { description: "was issued for another API", claims: () => ({ aud: "https://other-api.example.com" }) },
      { description: "was issued for another application", claims: () => ({ aud: faker.string.alphanumeric(32) }) },
      { description: "has no audience", claims: () => ({ aud: undefined }) },
      { description: "has no issuer", claims: () => ({ iss: undefined }) },
      { description: "has no subject", claims: () => ({ sub: undefined }) }
    ])("rejects a token that $description", async ({ claims }) => {
      const { service, signToken } = await setup();

      expect(await service.getValidUserId(await signToken(claims()))).toBeNull();
    });

    it("rejects a token signed by another key under a trusted key id", async () => {
      const { service, signToken, signingKey } = await setup();
      const outsider = await createSigningKey();

      expect(await service.getValidUserId(await signToken({}, { privateKey: outsider.privateKey, kid: signingKey.jwk.kid }))).toBeNull();
    });

    it("rejects a token signed by a key outside the key set", async () => {
      const { service, signToken } = await setup();
      const outsider = await createSigningKey();

      expect(await service.getValidUserId(await signToken({}, outsider))).toBeNull();
    });

    it("rejects a token signed with a shared secret", async () => {
      const { service, validClaims, signingKey } = await setup();
      const token = await new SignJWT(validClaims())
        .setProtectedHeader({ alg: "HS256", kid: signingKey.jwk.kid })
        .sign(new TextEncoder().encode(faker.string.alphanumeric(32)));

      expect(await service.getValidUserId(token)).toBeNull();
    });

    it("rejects an unsigned token", async () => {
      const { service, validClaims } = await setup();

      expect(await service.getValidUserId(new UnsecuredJWT(validClaims()).encode())).toBeNull();
    });

    it("rejects a malformed token", async () => {
      const { service } = await setup();

      expect(await service.getValidUserId("Bearer not-a-token")).toBeNull();
    });

    it("logs why a token was rejected", async () => {
      const { service, signToken, logger } = await setup();

      await service.getValidUserId(await signToken({ exp: secondsFromNow(-60) }));

      expect(logger.info).toHaveBeenCalledWith({ event: "ACCESS_TOKEN_REJECTED", reason: "ERR_JWT_EXPIRED" });
    });

    it("propagates a failure to fetch the signing keys", async () => {
      const { service, signToken } = await setup({ jwksStatus: 503 });

      await expect(service.getValidUserId(await signToken())).rejects.toThrow("Expected 200 OK from the JSON Web Key Set HTTP response");
    });
  });

  describe("signing key cache", () => {
    it("keeps verifying with the fetched keys for up to five minutes", async () => {
      const { service, signToken, publishKeys, jwksFetches } = await setup();
      vi.useFakeTimers({ toFake: ["Date"] });
      const token = await signToken();
      await service.getValidUserId(token);

      publishKeys([(await createSigningKey()).jwk]);
      vi.setSystemTime(Date.now() + 4 * 60 * 1000);

      expect(await service.getValidUserId(token)).not.toBeNull();
      expect(jwksFetches()).toBe(1);
    });

    it("stops trusting a key removed from the key set once the cached keys are five minutes old", async () => {
      const { service, signToken, publishKeys, jwksFetches } = await setup();
      vi.useFakeTimers({ toFake: ["Date"] });
      const token = await signToken();
      await service.getValidUserId(token);

      publishKeys([(await createSigningKey()).jwk]);
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1000);

      expect(await service.getValidUserId(token)).toBeNull();
      expect(jwksFetches()).toBe(2);
    });

    it("refetches the key set for a token signed with a new key at most every 30 seconds", async () => {
      const { service, signToken, signingKey, publishKeys, jwksFetches } = await setup();
      vi.useFakeTimers({ toFake: ["Date"] });
      const fetchedAt = Date.now();
      await service.getValidUserId(await signToken());
      const nextKey = await createSigningKey();
      const sub = faker.string.uuid();
      publishKeys([signingKey.jwk, nextKey.jwk]);

      vi.setSystemTime(fetchedAt + 29 * 1000);
      expect(await service.getValidUserId(await signToken({ sub }, nextKey))).toBeNull();
      expect(jwksFetches()).toBe(1);

      vi.setSystemTime(fetchedAt + 31 * 1000);
      expect(await service.getValidUserId(await signToken({ sub }, nextKey))).toBe(sub);
      expect(await service.getValidUserId(await signToken({}, await createSigningKey()))).toBeNull();
      expect(jwksFetches()).toBe(2);
    });
  });

  async function setup(input: { issuers?: string[]; audiences?: string[]; jwksStatus?: number } = {}) {
    const signingKey = await createSigningKey();
    let servedKeys: JWK[] = [signingKey.jwk];
    let fetchCount = 0;
    const jwksServer = createServer((request, response) => {
      fetchCount++;
      response.writeHead(request.url === JWKS_PATH ? input.jwksStatus ?? 200 : 404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ keys: servedKeys }));
    });
    await new Promise<void>(resolve => jwksServer.listen(0, "127.0.0.1", resolve));
    onTestFinished(() => {
      vi.useRealTimers();
      jwksServer.close();
      jwksServer.closeAllConnections();
    });

    const authConfigService = mockConfigService<AuthConfigService>({
      AUTH0_JWKS_URI: `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}${JWKS_PATH}`,
      AUTH0_ISSUER: (input.issuers ?? [ISSUER]) as [string, ...string[]],
      AUTH0_AUDIENCE: (input.audiences ?? [AUDIENCE]) as [string, ...string[]]
    });
    const logger = mock<LoggerService>();
    const service = new UserAuthTokenService(authConfigService, () => logger);

    const validClaims = (): JWTPayload => ({ iss: ISSUER, aud: AUDIENCE, sub: faker.string.uuid(), iat: secondsFromNow(0), exp: secondsFromNow(3600) });
    const signToken = (claims: JWTPayload = {}, key: { privateKey: KeyLike; kid?: string } = signingKey) => {
      const payload = Object.fromEntries(Object.entries({ ...validClaims(), ...claims }).filter(([, value]) => value !== undefined));
      return new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: key.kid }).sign(key.privateKey);
    };

    return {
      service,
      logger,
      signingKey,
      validClaims,
      signToken,
      publishKeys: (keys: JWK[]) => {
        servedKeys = keys;
      },
      jwksFetches: () => fetchCount
    };
  }

  async function createSigningKey() {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const kid = faker.string.alphanumeric(21);
    return { privateKey, kid, jwk: { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" } };
  }

  function secondsFromNow(seconds: number) {
    return Math.floor(Date.now() / 1000) + seconds;
  }
});
