import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

const PROBE_PATH = "/v1/feature-flag-gate-probes";

const probeRouter = new OpenApiHonoHandler();
probeRouter.openapi(
  createRoute({
    method: "post",
    path: PROBE_PATH,
    operationId: "createFeatureFlagGateProbe",
    summary: "Test-only route behind the organizations flag",
    tags: ["Test"],
    security: SECURITY_BEARER_OR_API_KEY,
    featureFlag: FeatureFlags.ORGANIZATIONS,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: z.object({ data: z.object({ name: z.string() }) }) } }
      }
    },
    responses: {
      200: { description: "Reached the handler", content: { "application/json": { schema: z.object({ reachedBy: z.string() }) } } }
    }
  }),
  async function createFeatureFlagGateProbe(c) {
    return c.json({ reachedBy: container.resolve(AuthService).currentUser.id }, 200);
  }
);
app.route("/", probeRouter);

describe("Route behind a feature flag", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const featureFlagsService = container.resolve(FeatureFlagsService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("lets a signed-in user the flag is on for reach the handler", async () => {
    const { user, bearer } = await setupCaller({ flagOn: true });

    const response = await probe({ authorization: bearer }, validBody());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reachedBy: user.id });
  });

  it("lets an API key caller the flag is on for reach the handler", async () => {
    const { user, apiKey } = await setupCaller({ flagOn: true });

    const response = await probe({ "x-api-key": apiKey }, validBody());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reachedBy: user.id });
  });

  it("answers like an unknown path to a signed-in user the flag is off for", async () => {
    const { bearer } = await setupCaller({ flagOn: false });

    const response = await probe({ authorization: bearer }, validBody());

    await expectUnknownPathAnswer(response, { authorization: bearer });
  });

  it("answers like an unknown path to an API key caller the flag is off for", async () => {
    const { apiKey } = await setupCaller({ flagOn: false });

    const response = await probe({ "x-api-key": apiKey }, validBody());

    await expectUnknownPathAnswer(response, { "x-api-key": apiKey });
  });

  it("answers like an unknown path to an anonymous caller the flag is off for", async () => {
    enableOrganizationsFlagOnlyFor(faker.string.uuid());

    const response = await probe({}, validBody());

    await expectUnknownPathAnswer(response, {});
  });

  it("answers unauthorized to an anonymous caller once the flag is on for everyone", async () => {
    const response = await probe({}, validBody());

    expect(response.status).toBe(401);
  });

  it("answers like an unknown path before validating the body of a caller the flag is off for", async () => {
    const { apiKey } = await setupCaller({ flagOn: false });

    const response = await probe({ "x-api-key": apiKey }, {});

    await expectUnknownPathAnswer(response, { "x-api-key": apiKey });
  });

  it("validates the body of a caller the flag is on for", async () => {
    const { apiKey } = await setupCaller({ flagOn: true });

    const response = await probe({ "x-api-key": apiKey }, {});

    expect(response.status).toBe(400);
  });

  function validBody() {
    return { data: { name: faker.word.noun() } };
  }

  async function probe(headers: Record<string, string>, body: unknown) {
    return await app.request(PROBE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
  }

  async function expectUnknownPathAnswer(response: Response, headers: Record<string, string>) {
    const unknownPathResponse = await app.request(`/v1/${faker.string.alphanumeric(24)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(validBody())
    });

    expect(unknownPathResponse.status).toBe(404);
    expect([response.status, await response.text()]).toEqual([unknownPathResponse.status, await unknownPathResponse.text()]);
  }

  async function setupCaller(input: { flagOn: boolean }) {
    const user = await userRepository.create({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
    const bearerToken = faker.string.alphanumeric(40);
    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === bearerToken ? user.userId! : null
    );
    const apiKey = await seedApiKey(user.id);
    enableOrganizationsFlagOnlyFor(input.flagOn ? user.id : faker.string.uuid());

    return { user, bearer: `Bearer ${bearerToken}`, apiKey };
  }

  function enableOrganizationsFlagOnlyFor(userId: string) {
    vi.spyOn(featureFlagsService, "isEnabled").mockImplementation(
      flag => flag !== FeatureFlags.ORGANIZATIONS || container.resolve(AuthService).safeCurrentUser?.id === userId
    );
  }

  async function seedApiKey(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      userId,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }
});
