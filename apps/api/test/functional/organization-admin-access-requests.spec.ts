import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { AdminAccessRequestEmailJob } from "@src/organization/services/admin-access-request-email/admin-access-request-email.handler";
import { app } from "@src/rest-app";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const EMAIL_JOB = AdminAccessRequestEmailJob[JOB_NAME];

describe("Requesting admin access to an organization", () => {
  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/organizations/{id}/admin-access-requests", () => {
    it.each<OrganizationRole>(["member", "billing", "viewer"])("queues an email to every owner for a caller with role %s", async role => {
      const { team, owner, secondOwner, member, requestAdminAccess } = await setup({ memberRole: role });

      const response = await requestAdminAccess();

      expect(response.status).toBe(204);
      const jobs = await findJobRows(EMAIL_JOB, { data: { organizationId: team.id, requesterUserId: member.id } });
      expect(jobs.map(job => job.data.ownerUserId).sort()).toEqual([owner.id, secondOwner.id].sort());
    });

    it("refuses a second request the same day without emailing the owners again", async () => {
      const { team, member, requestAdminAccess } = await setup({ memberRole: "member" });
      await requestAdminAccess();

      const response = await requestAdminAccess();

      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ code: "admin_access_request_limit_reached" });
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(await findJobRows(EMAIL_JOB, { data: { organizationId: team.id, requesterUserId: member.id } })).toHaveLength(2);
    });

    it.each<OrganizationRole>(["owner", "admin"])("refuses a caller with role %s, who already manages the organization", async role => {
      const { team, member, requestAdminAccess } = await setup({ memberRole: role });

      const response = await requestAdminAccess();

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "already_admin" });
      expect(await findJobRows(EMAIL_JOB, { data: { organizationId: team.id, requesterUserId: member.id } })).toEqual([]);
    });

    it("refuses a personal organization", async () => {
      const { personal, request } = await setup({});

      const response = await request(`/v1/organizations/${personal.id}/admin-access-requests`, { "x-organization-id": personal.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "personal_organization" });
    });

    it("answers not found for a team of the caller other than the active one", async () => {
      const { team, member, request } = await setup({});

      const response = await request(`/v1/organizations/${team.id}/admin-access-requests`);

      expect(response.status).toBe(404);
      expect(await findJobRows(EMAIL_JOB, { data: { organizationId: team.id, requesterUserId: member.id } })).toEqual([]);
    });

    it("refuses an API key", async () => {
      const { team, member } = await setup({});
      const apiKey = await seedApiKey(member.id, team.id);

      const response = await app.request(`/v1/organizations/${team.id}/admin-access-requests`, { method: "POST", headers: { "x-api-key": apiKey } });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { requestAdminAccess } = await setup({ organizationsOn: false });

      const response = await requestAdminAccess();

      expect(response.status).toBe(404);
    });
  });

  async function seedApiKey(userId: string, organizationId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      userId,
      organizationId,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  async function setup(input: { memberRole?: OrganizationRole; organizationsOn?: boolean }) {
    const signedInUser = () => ({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: signedInUser() });
    const secondOwner = await seedUser(signedInUser());
    await seedOrganizationMember({ organizationId: team.id, userId: secondOwner.id, role: "owner" });
    const member = await seedUser(signedInUser());
    await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: input.memberRole ?? "member" });
    const personal = await seedOrganization({ type: "personal", createdByUserId: member.id });
    await seedOrganizationMember({ organizationId: personal.id, userId: member.id, role: "owner" });

    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? member.userId! : null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false;
    });

    async function request(path: string, headers: Record<string, string> = {}) {
      return await app.request(path, { method: "POST", headers: { authorization: `Bearer ${token}`, ...headers } });
    }

    async function requestAdminAccess() {
      return await request(`/v1/organizations/${team.id}/admin-access-requests`, { "x-organization-id": team.id });
    }

    return { team, personal, owner, secondOwner, member, request, requestAdminAccess };
  }
});
