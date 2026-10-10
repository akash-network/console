import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";

type ApiKeyBody = { data: { id: string; organizationId: string | null; projectId: string | null } };

describe("Organization API keys", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/api-keys", () => {
    it("binds a key to the active organization and to no project", async () => {
      const { team, bearer } = await setup({});

      const response = await createKey({ authorization: bearer, "x-organization-id": team.id }, {});

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { organizationId: team.id, projectId: null } });
    });

    it("binds a key to one project of the active organization, which is all the key reaches", async () => {
      const { user, team, teamProject, bearer } = await setup({});
      const ciProject = await seedProject({ organizationId: team.id });
      const [inProject, outsideProject] = await Promise.all([
        seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: ciProject.id, autoTopUpEnabled: false }),
        seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: teamProject.id, autoTopUpEnabled: false })
      ]);

      const response = await createKey({ authorization: bearer, "x-organization-id": team.id }, { projectId: ciProject.id });
      const { data } = (await response.json()) as ApiKeyBody & { data: { apiKey: string } };

      expect(response.status).toBe(201);
      expect(data).toMatchObject({ organizationId: team.id, projectId: ciProject.id });
      expect((await getDeploymentSetting(inProject, { "x-api-key": data.apiKey })).status).toBe(200);
      expect((await getDeploymentSetting(outsideProject, { "x-api-key": data.apiKey })).status).toBe(404);
    });

    it("rejects a project of another organization", async () => {
      const { team, personalProject, bearer } = await setup({});

      const response = await createKey({ authorization: bearer, "x-organization-id": team.id }, { projectId: personalProject.id });

      expect(response.status).toBe(404);
    });

    it("rejects a deleted project", async () => {
      const { team, bearer } = await setup({});
      const deleted = await seedProject({ organizationId: team.id, deletedAt: new Date() });

      const response = await createKey({ authorization: bearer, "x-organization-id": team.id }, { projectId: deleted.id });

      expect(response.status).toBe(404);
    });

    it("rejects a project the member was not granted and accepts one they were", async () => {
      const { user, team, teamProject, bearer } = await setup({ teamRole: "member" });
      const granted = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id });

      const [notGrantedResponse, grantedResponse] = await Promise.all([
        createKey({ authorization: bearer, "x-organization-id": team.id }, { projectId: teamProject.id }),
        createKey({ authorization: bearer, "x-organization-id": team.id }, { projectId: granted.id })
      ]);

      expect(notGrantedResponse.status).toBe(404);
      expect(grantedResponse.status).toBe(201);
    });

    it("keeps a key created with a project-bound key inside that project", async () => {
      const { user, team } = await setup({});
      const ciProject = await seedProject({ organizationId: team.id });
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id, projectId: ciProject.id });

      const response = await createKey({ "x-api-key": apiKey }, {});

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { organizationId: team.id, projectId: ciProject.id } });
    });

    it("binds a key to the personal organization while organizations are off for the caller", async () => {
      const { personal, bearer } = await setup({ organizationsOn: false });

      const response = await createKey({ authorization: bearer }, {});

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { organizationId: personal.id, projectId: null } });
    });

    it("rejects a project while organizations are off for the caller", async () => {
      const { personalProject, bearer } = await setup({ organizationsOn: false });

      const response = await createKey({ authorization: bearer }, { projectId: personalProject.id });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /v1/api-keys", () => {
    it("lists the caller's keys of the active organization only", async () => {
      const { user, personal, team, bearer } = await setup({});
      const [, teamKey] = await Promise.all([
        seedApiKey({ userId: user.id, organizationId: personal.id }),
        seedApiKey({ userId: user.id, organizationId: team.id })
      ]);

      const response = await listKeys({ authorization: bearer, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [expect.objectContaining({ id: teamKey.key.id, organizationId: team.id, projectId: null })]
      });
    });

    it("lists only the keys of its own project to a project-bound key", async () => {
      const { user, team } = await setup({});
      const ciProject = await seedProject({ organizationId: team.id });
      await seedApiKey({ userId: user.id, organizationId: team.id });
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id, projectId: ciProject.id });

      const response = await listKeys({ "x-api-key": apiKey });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [expect.objectContaining({ organizationId: team.id, projectId: ciProject.id })] });
    });

    it("lists every key of the caller while organizations are off for the caller", async () => {
      const { user, personal, team, bearer } = await setup({ organizationsOn: false });
      const keys = await Promise.all([
        seedApiKey({ userId: user.id, organizationId: personal.id }),
        seedApiKey({ userId: user.id, organizationId: team.id })
      ]);

      const response = await listKeys({ authorization: bearer });
      const { data } = (await response.json()) as { data: { id: string }[] };

      expect(response.status).toBe(200);
      expect(data.map(({ id }) => id).sort()).toEqual(keys.map(({ key }) => key.id).sort());
    });
  });

  describe("a key bound to an organization", () => {
    it("rejects an organization header naming another organization", async () => {
      const { user, personal, team } = await setup({});
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await listWallets(user.id, { "x-api-key": apiKey, "x-organization-id": personal.id });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "organization_mismatch" });
    });

    it("reads the wallet of its organization and not its owner's personal one", async () => {
      const { user, personal, team, teamOwner } = await setup({});
      const [, teamWallet] = await Promise.all([seedWallet(user.id, personal.id), seedWallet(teamOwner.id, team.id)]);
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id });

      const [teamResponse, personalResponse] = await Promise.all([
        listWallets(teamOwner.id, { "x-api-key": apiKey }),
        listWallets(user.id, { "x-api-key": apiKey })
      ]);

      expect(await walletAddressesOf(teamResponse)).toEqual([teamWallet.address]);
      expect(await walletAddressesOf(personalResponse)).toEqual([]);
    });

    it("acts in its owner's personal organization when it was created before organizations", async () => {
      const { user, personal, team, teamOwner } = await setup({});
      const [personalWallet] = await Promise.all([seedWallet(user.id, personal.id), seedWallet(teamOwner.id, team.id)]);
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: null });

      const [personalResponse, teamResponse] = await Promise.all([
        listWallets(user.id, { "x-api-key": apiKey }),
        listWallets(teamOwner.id, { "x-api-key": apiKey })
      ]);

      expect(await walletAddressesOf(personalResponse)).toEqual([personalWallet.address]);
      expect(await walletAddressesOf(teamResponse)).toEqual([]);
    });
  });

  describe("a key of an organization member", () => {
    it("loses the projects its owner was not granted once the owner is demoted to member", async () => {
      const { user, team, teamProject, membership } = await setup({ teamRole: "owner" });
      const setting = await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: teamProject.id, autoTopUpEnabled: false });
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id });

      const asOwner = await getDeploymentSetting(setting, { "x-api-key": apiKey });
      await db.update(resolveTable("OrganizationMembers")).set({ role: "member" }).where(eq(resolveTable("OrganizationMembers").id, membership.id));
      const asMember = await getDeploymentSetting(setting, { "x-api-key": apiKey });

      expect(asOwner.status).toBe(200);
      expect(asMember.status).toBe(404);
    });

    it("is rejected once its owner leaves the organization", async () => {
      const { user, team, membership } = await setup({});
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id });

      const asMember = await listKeys({ "x-api-key": apiKey });
      await db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").id, membership.id));
      const afterLeaving = await listKeys({ "x-api-key": apiKey });

      expect(asMember.status).toBe(200);
      expect(afterLeaving.status).toBe(403);
      expect(await afterLeaving.json()).toMatchObject({ code: "organization_forbidden" });
    });
  });

  async function createKey(headers: Record<string, string>, body: { projectId?: string }) {
    return await app.request("/v1/api-keys", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ data: { name: "ci", ...body } })
    });
  }

  async function listKeys(headers: Record<string, string>) {
    return await app.request("/v1/api-keys", { headers });
  }

  async function listWallets(userId: string, headers: Record<string, string>) {
    return await app.request(`/v1/wallets?userId=${userId}`, { headers });
  }

  async function walletAddressesOf(response: Response) {
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { address: string }[] };

    return data.map(wallet => wallet.address);
  }

  async function getDeploymentSetting(setting: { userId: string; dseq: string }, headers: Record<string, string>) {
    return await app.request(`/v1/deployment-settings/${setting.userId}/${setting.dseq}`, { headers });
  }

  async function seedWallet(userId: string, organizationId: string) {
    const [wallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId, organizationId, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();

    return wallet;
  }

  async function seedApiKey(input: { userId: string; organizationId: string | null; projectId?: string }) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    const key = await container.resolve(ApiKeyRepository).create({
      ...input,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: faker.word.noun()
    });

    return { apiKey, key };
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

  async function setup(input: { organizationsOn?: boolean; teamRole?: OrganizationRole }) {
    const {
      user,
      organization: personal,
      project: personalProject
    } = await seedOrganizationWithOwner({
      type: "personal",
      user: { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` }
    });
    const { user: teamOwner, organization: team, project: teamProject } = await seedOrganizationWithOwner();
    const membership = await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: input.teamRole ?? "admin" });
    const bearer = signIn(user.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [user.id]);

    return { user, personal, personalProject, team, teamOwner, teamProject, membership, bearer };
  }
});
