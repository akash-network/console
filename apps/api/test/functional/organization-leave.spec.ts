import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type OrganizationList = { data: { id: string; type: string; isActive: boolean }[] };

describe("Leaving an organization", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const memberRepository = container.resolve(OrganizationMemberRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("DELETE /v1/organizations/{id}/membership", () => {
    it.each<OrganizationRole>(["admin", "member", "billing", "viewer"])("lets a caller with role %s leave the active team", async role => {
      const { team, member, membership, leave, request } = await setup({ memberRole: role });

      const response = await leave(member);

      expect(response.status).toBe(204);
      expect(await memberRepository.findById(membership.id)).toBeUndefined();
      const afterLeaving = await request(member, "/v1/organization-members", { "x-organization-id": team.id });
      expect(afterLeaving.status).toBe(403);
      expect(await afterLeaving.json()).toMatchObject({ code: "organization_forbidden" });
    });

    it("lands a caller who last used the team on their personal organization", async () => {
      const { team, member, leave, request } = await setup({ memberRole: "member" });
      await db
        .update(resolveTable("Users"))
        .set({ lastUsedOrganizationId: team.id })
        .where(eq(resolveTable("Users").id, member.id));

      await leave(member);
      const response = await request(member, "/v1/organizations");

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as OrganizationList;
      expect(data).toEqual([expect.objectContaining({ type: "personal", isActive: true })]);
    });

    it("refuses the owner, who has to transfer ownership first", async () => {
      const { owner, ownerMembership, leave } = await setup({});

      const response = await leave(owner);

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "owner_cannot_leave" });
      expect(await memberRepository.findById(ownerMembership.id)).toBeDefined();
    });

    it("refuses to leave a personal organization", async () => {
      const { member, personal, request } = await setup({});

      const response = await request(member, `/v1/organizations/${personal.id}/membership`, { "x-organization-id": personal.id }, "DELETE");

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "personal_organization" });
    });

    it("answers not found for a team of the caller other than the active one", async () => {
      const { team, member, membership, request } = await setup({});

      const response = await request(member, `/v1/organizations/${team.id}/membership`, {}, "DELETE");

      expect(response.status).toBe(404);
      expect(await memberRepository.findById(membership.id)).toBeDefined();
    });

    it("refuses an API key", async () => {
      const { team, member, membership } = await setup({});
      const apiKey = await seedApiKey(member.id, team.id);

      const response = await app.request(`/v1/organizations/${team.id}/membership`, { method: "DELETE", headers: { "x-api-key": apiKey } });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await memberRepository.findById(membership.id)).toBeDefined();
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { member, membership, leave } = await setup({ organizationsOn: false });

      const response = await leave(member);

      expect(response.status).toBe(404);
      expect(await memberRepository.findById(membership.id)).toBeDefined();
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
    const tokens = new Map<string, string>();
    const signedInUser = () => ({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
    const { user: owner, organization: team, membership: ownerMembership } = await seedOrganizationWithOwner({ user: signedInUser() });
    const member = await seedUser(signedInUser());
    const membership = await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: input.memberRole ?? "member" });
    const personal = await seedOrganization({ type: "personal", createdByUserId: member.id });
    await seedOrganizationMember({ organizationId: personal.id, userId: member.id, role: "owner" });

    for (const user of [owner, member]) {
      tokens.set(user.id, faker.string.alphanumeric(40));
    }
    const externalUserIdByToken = new Map([...tokens].map(([id, token]) => [token, id === owner.id ? owner.userId! : member.userId!]));
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => externalUserIdByToken.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false;
    });

    async function request(user: Pick<UserOutput, "id">, path: string, headers: Record<string, string> = {}, method = "GET") {
      return await app.request(path, { method, headers: { authorization: `Bearer ${tokens.get(user.id)}`, ...headers } });
    }

    async function leave(user: Pick<UserOutput, "id">) {
      return await request(user, `/v1/organizations/${team.id}/membership`, { "x-organization-id": team.id }, "DELETE");
    }

    return { team, personal, owner, ownerMembership, member, membership, request, leave };
  }
});
