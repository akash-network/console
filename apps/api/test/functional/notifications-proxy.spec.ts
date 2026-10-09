import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe("Notifications proxy", () => {
  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("drops the identity headers a client sent and forwards the ones it minted for the caller", async () => {
    const { apiKey, user, address } = await setup();
    const forwarded = interceptNotifications("get", "/v1/alerts");

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
    expect(forwarded.headers()).toMatchObject({
      "x-user-id": user.id,
      "x-owner-address": address,
      "x-organization-id": await personalOrganizationIdOf(user.id)
    });
    expect(forwarded.headers()).not.toHaveProperty("x-organization-role");
    expect(forwarded.headers()).not.toHaveProperty("x-project-scope");
    expect(forwarded.headers()).not.toHaveProperty("x-project-id");
  });

  it("mints the caller's role and project scope while organization rules apply", async () => {
    const { apiKey, user } = await setup();
    enableOrganizations();
    const forwarded = interceptNotifications("get", "/v1/alerts");

    const response = await app.request("/v1/alerts", { headers: { "x-api-key": apiKey } });

    expect(response.status).toBe(200);
    expect(forwarded.headers()).toMatchObject({
      "x-user-id": user.id,
      "x-organization-id": await personalOrganizationIdOf(user.id),
      "x-organization-role": "owner",
      "x-project-scope": JSON.stringify({ kind: "all" })
    });
  });

  it("mints the project of the deployment whose alerts it writes", async () => {
    const { apiKey, user } = await setup();
    enableOrganizations();
    await app.request("/v1/alerts", { headers: { "x-api-key": apiKey } });
    const organizationId = await personalOrganizationIdOf(user.id);
    const project = await container.resolve(ProjectRepository).findDefaultByOrganizationId(organizationId);
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: user.id, dseq, organizationId, projectId: project!.id });
    const forwarded = interceptNotifications("post", `/v1/deployment-alerts/${dseq}`);

    const response = await app.request(`/v1/deployment-alerts/${dseq}`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ data: { alerts: { deploymentClosed: { notificationChannelId: faker.string.uuid(), enabled: true } } } })
    });

    expect(response.status).toBe(200);
    expect(forwarded.headers()).toMatchObject({ "x-organization-id": organizationId, "x-project-id": project!.id });
  });

  it("refuses an organization the caller does not belong to", async () => {
    const { user } = await setup();
    const apiKey = await persistApiKeyFor(user.id, (await seedOrganization()).id);
    enableOrganizations();
    const forwarded = interceptNotifications("get", "/v1/alerts");

    const response = await app.request("/v1/alerts", { headers: { "x-api-key": apiKey } });

    expect(response.status).toBe(403);
    expect(forwarded.reached()).toBe(false);
  });

  it("refuses a billing member of the organization", async () => {
    const { user } = await setup();
    const organization = await seedOrganization();
    await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role: "billing" });
    const apiKey = await persistApiKeyFor(user.id, organization.id);
    enableOrganizations();
    const forwarded = interceptNotifications("get", "/v1/alerts");

    const response = await app.request("/v1/alerts", { headers: { "x-api-key": apiKey } });

    expect(response.status).toBe(403);
    expect(forwarded.reached()).toBe(false);
  });

  function enableOrganizations() {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
  }

  async function personalOrganizationIdOf(userId: string) {
    return (await container.resolve(OrganizationRepository).findPersonalByUserId(userId))!.id;
  }

  function interceptNotifications(method: "get" | "post", path: string) {
    let forwarded: Record<string, string | string[] | undefined> | undefined;

    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .intercept(path, method.toUpperCase())
      .reply(function reply(this: nock.ReplyFnContext) {
        forwarded = this.req.headers;

        return [200, { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }];
      });

    return { headers: () => forwarded ?? {}, reached: () => forwarded !== undefined };
  }

  async function persistApiKeyFor(userId: string, organizationId?: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();

    await container.resolve(ApiKeyRepository).create({
      userId,
      organizationId,
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
