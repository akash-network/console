import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { MAX_ORGANIZATION_NAME_LENGTH } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { MAX_TEAM_ORGANIZATIONS_PER_USER } from "@src/organization/services/team-organization/team-organization.service";
import { app } from "@src/rest-app";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";

describe("Organization creation and renaming", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const registry = container.resolve<Registry>(TYPE_REGISTRY);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/organizations", () => {
    it("creates a team organization owned by the caller, with a default project and a wallet without a trial", async () => {
      const { user, bearer } = await setupCaller({});
      const suffix = faker.string.alpha(10).toLowerCase();

      const response = await createOrganization({ authorization: bearer }, { name: `  Acme ${suffix.toUpperCase()}  ` });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data).toEqual({
        id: expect.any(String),
        name: `Acme ${suffix.toUpperCase()}`,
        slug: `acme-${suffix}`,
        type: "team",
        role: "owner",
        isActive: false,
        createdAt: expect.any(String)
      });
      expect(await readOrganizationRows(data.id)).toEqual({
        members: [expect.objectContaining({ userId: user.id, role: "owner" })],
        projects: [expect.objectContaining({ slug: "default", isDefault: true })],
        wallets: [expect.objectContaining({ userId: null, createdByUserId: user.id, isTrialing: false, activatedAt: null, address: expect.stringMatching(/^akash1/) })]
      });
    });

    it("answers payment required when the new organization spends before it is funded", async () => {
      const { user, bearer } = await setupCaller({});
      const created = await createOrganization({ authorization: bearer }, { name: "Acme Corp" });
      const { data: organization } = (await created.json()) as { data: { id: string } };
      const { wallets } = await readOrganizationRows(organization.id);

      const response = await app.request("/v1/tx", {
        method: "POST",
        body: JSON.stringify({ data: { userId: user.id, messages: [createDeploymentMessage(wallets[0].address!)] } }),
        headers: { "Content-Type": "application/json", authorization: bearer, "x-organization-id": organization.id }
      });

      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ code: "insufficient_balance" });
    });

    it("refuses a name the caller already uses for another organization, whatever its case", async () => {
      const { user, bearer } = await setupCaller({});
      const { organization: team } = await seedOrganizationWithOwner({ name: "Acme Corp" });
      await seedOrganizationMember({ organizationId: team.id, userId: user.id });

      const response = await createOrganization({ authorization: bearer }, { name: "ACME corp" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "organization_name_taken" });
    });

    it("refuses a caller who reached the number of organizations they can create, deleted ones included", async () => {
      const { user, bearer } = await setupCaller({});
      for (let index = 0; index < MAX_TEAM_ORGANIZATIONS_PER_USER; index++) {
        await seedOrganization({ createdByUserId: user.id, type: "team", deletedAt: new Date() });
      }

      const response = await createOrganization({ authorization: bearer }, { name: "Acme Corp" });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "organization_limit_reached" });
    });

    it("refuses a blank name", async () => {
      const { bearer } = await setupCaller({});

      const response = await createOrganization({ authorization: bearer }, { name: "   " });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "validation_error" });
    });

    it.each([
      { case: "a null character", name: "Acme\u0000Corp" },
      { case: "a right-to-left override", name: "Acme‮proc" },
      { case: "an isolate", name: "Acme ⁦Corp⁩" },
      { case: "only zero-width spaces", name: "​​" },
      { case: "only a Hangul filler", name: "ㅤ" },
      { case: "only a blank braille pattern", name: "⠀" }
    ])("refuses a name with $case", async ({ name }) => {
      const { user, bearer } = await setupCaller({});

      const response = await createOrganization({ authorization: bearer }, { name });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "validation_error" });
      expect(await readOrganizationTypesCreatedBy(user.id)).toEqual(["personal"]);
    });

    it("accepts a name in a script without latin letters", async () => {
      const { bearer } = await setupCaller({});

      const response = await createOrganization({ authorization: bearer }, { name: "株式会社" });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { name: "株式会社", slug: expect.stringMatching(/^organization-[0-9a-f]{8}$/) } });
    });

    it("refuses a rename to a name without a visible character", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "owner" });

      const response = await renameOrganization(team.id, { authorization: bearer, "x-organization-id": team.id }, { name: "​" });

      expect(response.status).toBe(400);
      expect(await readOrganizationName(team.id)).toBe(team.name);
    });

    it("refuses a name longer than the column", async () => {
      const { bearer } = await setupCaller({});

      const response = await createOrganization({ authorization: bearer }, { name: "a".repeat(MAX_ORGANIZATION_NAME_LENGTH + 1) });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "validation_error" });
    });

    it("refuses an API key limited to a project, without creating anything", async () => {
      const { user, personal, personalProject } = await setupCaller({});
      const apiKey = await seedApiKey({ userId: user.id, organizationId: personal.id, projectId: personalProject.id });

      const response = await createOrganization({ "x-api-key": apiKey }, { name: "Acme Corp" });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await readOrganizationTypesCreatedBy(user.id)).toEqual(["personal"]);
    });

    it("refuses an API key bound to the whole organization, without creating anything", async () => {
      const { user, team } = await setupCaller({ teamRole: "owner" });
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await createOrganization({ "x-api-key": apiKey }, { name: "Acme Corp" });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await readOrganizationTypesCreatedBy(user.id)).toEqual(["personal"]);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { user, bearer } = await setupCaller({ organizationsOn: false });

      const response = await createOrganization({ authorization: bearer }, { name: "Acme Corp" });

      expect(response.status).toBe(404);
      expect(await readOrganizationTypesCreatedBy(user.id)).toEqual(["personal"]);
    });

    it("answers unauthorized to an anonymous caller", async () => {
      vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(true);

      const response = await createOrganization({}, { name: "Acme Corp" });

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /v1/organizations/{id}", () => {
    it("lets an owner rename the active organization", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "owner" });

      const response = await renameOrganization(team.id, { authorization: bearer, "x-organization-id": team.id }, { name: "Acme Labs" });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: { id: team.id, name: "Acme Labs", slug: team.slug, type: "team", role: "owner", isActive: true, createdAt: team.createdAt.toISOString() }
      });
    });

    it("lets an admin rename the active organization", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "admin" });

      const response = await renameOrganization(team.id, { authorization: bearer, "x-organization-id": team.id }, { name: "Acme Labs" });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { name: "Acme Labs", role: "admin" } });
    });

    it("refuses an owner's API key limited to a project", async () => {
      const { user, team } = await setupCaller({ teamRole: "owner" });
      const project = await seedProject({ organizationId: team.id });
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id, projectId: project.id });

      const response = await renameOrganization(team.id, { "x-api-key": apiKey }, { name: "Acme Labs" });

      expect(response.status).toBe(403);
      expect(await readOrganizationName(team.id)).toBe(team.name);
    });

    it("lets an owner's API key bound to the whole organization rename it", async () => {
      const { user, team } = await setupCaller({ teamRole: "owner" });
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await renameOrganization(team.id, { "x-api-key": apiKey }, { name: "Acme Labs" });

      expect(response.status).toBe(200);
      expect(await readOrganizationName(team.id)).toBe("Acme Labs");
    });

    it("refuses a member", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "member" });

      const response = await renameOrganization(team.id, { authorization: bearer, "x-organization-id": team.id }, { name: "Acme Labs" });

      expect(response.status).toBe(403);
      expect(await readOrganizationName(team.id)).toBe(team.name);
    });

    it("answers not found for an organization of the caller other than the active one", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "owner" });

      const response = await renameOrganization(team.id, { authorization: bearer }, { name: "Acme Labs" });

      expect(response.status).toBe(404);
      expect(await readOrganizationName(team.id)).toBe(team.name);
    });

    it("answers not found for another organization's id", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "owner" });
      const { organization: foreign } = await seedOrganizationWithOwner();

      const response = await renameOrganization(foreign.id, { authorization: bearer, "x-organization-id": team.id }, { name: "Acme Labs" });

      expect(response.status).toBe(404);
      expect(await readOrganizationName(foreign.id)).toBe(foreign.name);
    });

    it("refuses to rename a personal organization", async () => {
      const { personal, bearer } = await setupCaller({});

      const response = await renameOrganization(personal.id, { authorization: bearer }, { name: "Acme Labs" });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "personal_organization" });
    });

    it("refuses a name the caller already uses for another organization", async () => {
      const { user, team, bearer } = await setupCaller({ teamRole: "owner" });
      const { organization: other } = await seedOrganizationWithOwner({ name: "Acme Labs" });
      await seedOrganizationMember({ organizationId: other.id, userId: user.id });

      const response = await renameOrganization(team.id, { authorization: bearer, "x-organization-id": team.id }, { name: "acme labs" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "organization_name_taken" });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { team, bearer } = await setupCaller({ teamRole: "owner", organizationsOn: false });

      const response = await renameOrganization(team.id, { authorization: bearer, "x-organization-id": team.id }, { name: "Acme Labs" });

      expect(response.status).toBe(404);
      expect(await readOrganizationName(team.id)).toBe(team.name);
    });
  });

  async function createOrganization(headers: Record<string, string>, data: { name: string }) {
    return await app.request("/v1/organizations", {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  async function renameOrganization(id: string, headers: Record<string, string>, data: { name: string }) {
    return await app.request(`/v1/organizations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  async function readOrganizationTypesCreatedBy(userId: string) {
    const organizations = await db.select().from(resolveTable("Organizations")).where(eq(resolveTable("Organizations").createdByUserId, userId));

    return organizations.map(organization => organization.type);
  }

  async function readOrganizationName(id: string) {
    const [organization] = await db.select().from(resolveTable("Organizations")).where(eq(resolveTable("Organizations").id, id));

    return organization.name;
  }

  async function readOrganizationRows(organizationId: string) {
    const members = await db.select().from(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").organizationId, organizationId));
    const projects = await db.select().from(resolveTable("Projects")).where(eq(resolveTable("Projects").organizationId, organizationId));
    const wallets = await db.select().from(resolveTable("UserWallets")).where(eq(resolveTable("UserWallets").organizationId, organizationId));

    return { members, projects, wallets };
  }

  function createDeploymentMessage(owner: string) {
    const message = { typeUrl: `/${MsgCreateDeployment.$type}`, value: MsgCreateDeployment.fromPartial({ id: { owner, dseq: 123 } }) };

    return { typeUrl: message.typeUrl, value: Buffer.from(registry.encode(message)).toString("base64") };
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

  async function seedApiKey(input: { userId: string; organizationId: string; projectId?: string }) {
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
