import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Organizations", () => {
  const userRepository = container.resolve(UserRepository);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/organizations", () => {
    it("lists the caller's organizations and runs in the personal one by default", async () => {
      const { personal, team, bearer, user } = await setupCaller({ teamRole: "member" });
      const { organization: deleted } = await seedOrganizationWithOwner({ deletedAt: new Date() });
      await seedOrganizationMember({ organizationId: deleted.id, userId: user.id });

      const response = await listOrganizations({ authorization: bearer });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          {
            id: personal.id,
            name: personal.name,
            slug: personal.slug,
            type: "personal",
            role: "owner",
            isActive: true,
            hasPaymentMethod: false,
            createdAt: personal.createdAt.toISOString()
          },
          {
            id: team.id,
            name: team.name,
            slug: team.slug,
            type: "team",
            role: "member",
            isActive: false,
            hasPaymentMethod: null,
            createdAt: team.createdAt.toISOString()
          }
        ]
      });
    });

    it("gives a caller without any organization their personal one", async () => {
      const user = await seedUser({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
      const bearer = signIn(user.userId!);
      enableOrganizationsFor([user.id]);

      const response = await listOrganizations({ authorization: bearer });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [expect.objectContaining({ type: "personal", role: "owner", isActive: true, name: user.username })]
      });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { bearer } = await setupCaller({ organizationsOn: false });

      const response = await listOrganizations({ authorization: bearer });

      expect(response.status).toBe(404);
    });

    it("answers unauthorized to an anonymous caller", async () => {
      vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(true);

      const response = await listOrganizations({});

      expect(response.status).toBe(401);
    });
  });

  describe("payment method", () => {
    it("tells any member of the active team that the team has a payment method", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "viewer" });
      const { user: owner } = await seedOrganizationWithOwner();
      await seedPaymentMethod({ organizationId: team.id, userId: owner.id });

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id });

      expect(await activeOrganizationOf(response)).toMatchObject({ id: team.id, hasPaymentMethod: true });
    });

    it("tells that the active team has no payment method while only its members hold cards", async () => {
      const { personal, team, user, bearer } = await setupCaller({ teamRole: "billing" });
      const { organization: otherTeam } = await seedOrganizationWithOwner();
      await seedPaymentMethod({ organizationId: personal.id, userId: user.id });
      await seedPaymentMethod({ organizationId: otherTeam.id, userId: user.id });

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id });

      expect(await activeOrganizationOf(response)).toMatchObject({ id: team.id, hasPaymentMethod: false });
    });

    it("reads the caller's own cards in their active personal organization, leaving out the ones they added for a team", async () => {
      const { personal, team, user, bearer } = await setupCaller({});
      await seedPaymentMethod({ organizationId: team.id, userId: user.id });
      const withoutOwnCard = await activeOrganizationOf(await listOrganizations({ authorization: bearer }));

      await seedPaymentMethod({ organizationId: personal.id, userId: user.id });
      const withOwnCard = await activeOrganizationOf(await listOrganizations({ authorization: bearer }));

      expect(withoutOwnCard).toMatchObject({ id: personal.id, hasPaymentMethod: false });
      expect(withOwnCard).toMatchObject({ id: personal.id, hasPaymentMethod: true });
    });
  });

  describe("organization header", () => {
    it("runs the request in an organization named by id", async () => {
      const { team, bearer } = await setupCaller({});

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id });

      expect(await activeOrganizationIdOf(response)).toBe(team.id);
    });

    it("runs the request in an organization named by slug, whatever its case", async () => {
      const { team, bearer } = await setupCaller({});

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.slug.toUpperCase() });

      expect(await activeOrganizationIdOf(response)).toBe(team.id);
    });

    it("rejects an organization the caller does not belong to", async () => {
      const { bearer } = await setupCaller({});
      const { organization: foreign } = await seedOrganizationWithOwner();

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": foreign.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "organization_forbidden" });
    });

    it("remembers the named organization as the one used last", async () => {
      const { team, bearer, user } = await setupCaller({});

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      await vi.waitFor(async () => expect((await userRepository.findById(user.id))?.lastUsedOrganizationId).toBe(team.id));
    });

    it("is ignored while organizations are off for the caller", async () => {
      const { bearer } = await setupCaller({ organizationsOn: false });
      const { organization: foreign } = await seedOrganizationWithOwner();

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: bearer, "x-organization-id": foreign.id, "x-project-id": faker.string.uuid() }
      });

      expect(response.status).toBe(200);
    });
  });

  describe("without an organization header", () => {
    it("runs the request in the organization used last while the caller still belongs to it", async () => {
      const { team, bearer, user } = await setupCaller({});
      await userRepository.updateById(user.id, { lastUsedOrganizationId: team.id });

      const response = await listOrganizations({ authorization: bearer });

      expect(await activeOrganizationIdOf(response)).toBe(team.id);
    });

    it("falls back to the personal organization and forgets the one used last once the caller left it", async () => {
      const { personal, bearer, user } = await setupCaller({});
      const { organization: left } = await seedOrganizationWithOwner();
      await userRepository.updateById(user.id, { lastUsedOrganizationId: left.id });

      const response = await listOrganizations({ authorization: bearer });

      expect(await activeOrganizationIdOf(response)).toBe(personal.id);
      await vi.waitFor(async () => expect((await userRepository.findById(user.id))?.lastUsedOrganizationId).toBeNull());
    });
  });

  describe("API key", () => {
    it("runs the request in the organization the key is bound to", async () => {
      const { team, user } = await setupCaller({});
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await listOrganizations({ "x-api-key": apiKey });

      expect(await activeOrganizationIdOf(response)).toBe(team.id);
    });

    it("accepts an organization header naming the key's own organization in upper case", async () => {
      const { team, user } = await setupCaller({});
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await listOrganizations({ "x-api-key": apiKey, "x-organization-id": team.id.toUpperCase() });

      expect(await activeOrganizationIdOf(response)).toBe(team.id);
    });

    it("reaches every project of the organization with an owner's key bound to no project", async () => {
      const { personal, personalProject, user } = await setupCaller({});
      const apiKey = await seedApiKey({ userId: user.id, organizationId: personal.id });

      const response = await listOrganizations({ "x-api-key": apiKey, "x-project-id": personalProject.id });

      expect(await activeOrganizationIdOf(response)).toBe(personal.id);
    });

    it("rejects an organization header naming another organization than the key's", async () => {
      const { team, personal, user } = await setupCaller({});
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await listOrganizations({ "x-api-key": apiKey, "x-organization-id": personal.slug });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "organization_mismatch" });
    });

    it("rejects a key whose owner no longer belongs to its organization", async () => {
      const { user } = await setupCaller({});
      const { organization: left } = await seedOrganizationWithOwner();
      const apiKey = await seedApiKey({ userId: user.id, organizationId: left.id });

      const response = await listOrganizations({ "x-api-key": apiKey });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "organization_forbidden" });
    });
  });

  describe("project header", () => {
    it("narrows the request to a project of the organization", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "admin" });
      const project = await seedProject({ organizationId: team.id });

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id, "x-project-id": project.id });

      expect(await activeOrganizationIdOf(response)).toBe(team.id);
    });

    it("rejects a project of another organization", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "admin" });
      const { project: foreign } = await seedOrganizationWithOwner();

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id, "x-project-id": foreign.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "project_forbidden" });
    });

    it("rejects a project the caller was not granted", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "member" });
      const project = await seedProject({ organizationId: team.id });

      const response = await listOrganizations({ authorization: bearer, "x-organization-id": team.id, "x-project-id": project.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "project_forbidden" });
    });
  });

  async function listOrganizations(headers: Record<string, string>) {
    return await app.request("/v1/organizations", { headers });
  }

  async function activeOrganizationIdOf(response: Response) {
    return (await activeOrganizationOf(response))?.id;
  }

  async function activeOrganizationOf(response: Response) {
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { id: string; isActive: boolean; hasPaymentMethod: boolean | null }[] };

    return data.find(organization => organization.isActive);
  }

  async function seedPaymentMethod(input: { organizationId: string | null; userId: string }) {
    await db.insert(resolveTable("PaymentMethods")).values({
      ...input,
      fingerprint: faker.string.alphanumeric(16),
      paymentMethodId: `pm_${faker.string.alphanumeric(14)}`
    });
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }

  async function seedApiKey(input: { userId: string; organizationId: string }) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  async function setupCaller(input: { organizationsOn?: boolean; teamRole?: OrganizationRole }) {
    const {
      user,
      organization: personal,
      project: personalProject
    } = await seedOrganizationWithOwner({
      type: "personal",
      user: { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` }
    });
    const { organization: team } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: input.teamRole ?? "member" });
    const bearer = signIn(user.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [user.id]);

    return { user, personal, personalProject, team, bearer };
  }
});
