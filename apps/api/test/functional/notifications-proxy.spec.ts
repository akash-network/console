import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe("Notifications proxy", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("drops the identity headers a client sent and forwards the ones it minted for the caller", async () => {
    const { apiKey, user, address } = await setup();
    const forwardedHeaders = interceptAlerts();

    const response = await app.request("/v1/alerts", {
      headers: {
        "x-api-key": apiKey,
        "x-user-id": faker.string.uuid(),
        "x-owner-address": createAkashAddress(),
        "x-organization-id": faker.string.uuid(),
        "x-organization-role": "owner",
        "x-project-scope": "all",
        "x-project-id": faker.string.uuid()
      }
    });

    expect(response.status).toBe(200);
    expect(forwardedHeaders()).toMatchObject({ "x-user-id": user.id, "x-owner-address": address });
    expect(forwardedHeaders()).not.toHaveProperty("x-organization-id");
    expect(forwardedHeaders()).not.toHaveProperty("x-organization-role");
    expect(forwardedHeaders()).not.toHaveProperty("x-project-scope");
    expect(forwardedHeaders()).not.toHaveProperty("x-project-id");
  });

  function interceptAlerts() {
    let forwarded: Record<string, string | string[] | undefined> = {};

    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .get("/v1/alerts")
      .reply(function reply(this: nock.ReplyFnContext) {
        forwarded = this.req.headers;

        return [200, { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }];
      });

    return () => forwarded;
  }

  async function persistApiKeyFor(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();

    await container.resolve(ApiKeyRepository).create({
      userId,
      name: faker.company.name(),
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
    });

    return apiKey;
  }

  async function setup() {
    const { user, address } = await seedUserWithWallet();
    const apiKey = await persistApiKeyFor(user.id);

    return { user, address, apiKey };
  }
});
