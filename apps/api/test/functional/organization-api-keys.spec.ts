import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";

type ApiKeyBody = { data: { id: string; organizationId: string | null; projectId: string | null } };

describe("Organization API keys", () => {
  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

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

    it("binds a key to the personal organization when the request names no organization", async () => {
      const { personal, bearer } = await setup({});

      const response = await createKey({ authorization: bearer }, {});

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { organizationId: personal.id, projectId: null } });
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
      const [, teamWallet] = await Promise.all([seedWallet(user.id, personal.id), seedWallet(null, team.id)]);
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id });

      const [ownerResponse, otherMemberResponse] = await Promise.all([
        listWallets(user.id, { "x-api-key": apiKey }),
        listWallets(teamOwner.id, { "x-api-key": apiKey })
      ]);

      expect(await walletAddressesOf(ownerResponse)).toEqual([teamWallet.address]);
      expect(await walletAddressesOf(otherMemberResponse)).toEqual([]);
    });
  });

  describe("an admin's key bound to a project", () => {
    it("is refused the organization-level routes", async () => {
      const { user, team } = await setup({ teamRole: "admin" });
      const ciProject = await seedProject({ organizationId: team.id });
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id, projectId: ciProject.id });
      const headers = { "x-api-key": apiKey };

      const responses = await Promise.all([
        listKeys(headers),
        createKey(headers, {}),
        app.request("/v1/wallet-settings", { headers }),
        app.request("/v1/stripe/payment-methods", { headers })
      ]);

      expect(responses.map(response => response.status)).toEqual([403, 403, 403, 403]);
    });

    it("works on its project and nowhere else", async () => {
      const { user, team, teamProject } = await setup({ teamRole: "admin" });
      const ciProject = await seedProject({ organizationId: team.id });
      const [inProject, outsideProject] = await Promise.all([
        seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: ciProject.id, autoTopUpEnabled: false }),
        seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: teamProject.id, autoTopUpEnabled: false })
      ]);
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id, projectId: ciProject.id });

      const [inProjectResponse, outsideProjectResponse, organizationsResponse] = await Promise.all([
        getDeploymentSetting(inProject, { "x-api-key": apiKey }),
        getDeploymentSetting(outsideProject, { "x-api-key": apiKey }),
        app.request("/v1/organizations", { headers: { "x-api-key": apiKey } })
      ]);

      expect(inProjectResponse.status).toBe(200);
      expect(outsideProjectResponse.status).toBe(404);
      expect(organizationsResponse.status).toBe(200);
      expect(await organizationsResponse.json()).toEqual({ data: [expect.objectContaining({ id: team.id, isActive: true })] });
    });
  });

  describe("a key of the personal organization", () => {
    it("keeps working when bound to the personal organization", async () => {
      const { user, personal } = await setup({});
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: personal.id });

      const response = await listKeys({ "x-api-key": apiKey });

      expect(response.status).toBe(200);
    });

    it("reaches only the project it is bound to", async () => {
      const { user, personal, personalProject } = await setup({});
      const ciProject = await seedProject({ organizationId: personal.id });
      const [inProject, outsideProject] = await Promise.all([
        seedDeploymentSetting({ userId: user.id, organizationId: personal.id, projectId: ciProject.id, autoTopUpEnabled: false }),
        seedDeploymentSetting({ userId: user.id, organizationId: personal.id, projectId: personalProject.id, autoTopUpEnabled: false })
      ]);
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: personal.id, projectId: ciProject.id });

      const [inProjectResponse, outsideProjectResponse] = await Promise.all([
        getDeploymentSetting(inProject, { "x-api-key": apiKey }),
        getDeploymentSetting(outsideProject, { "x-api-key": apiKey })
      ]);

      expect(inProjectResponse.status).toBe(200);
      expect(outsideProjectResponse.status).toBe(404);
    });
  });

  describe("a key of an organization member", () => {
    it("loses the projects its owner was not granted once the owner is demoted to member", async () => {
      const { user, team, teamProject, membership } = await setup({ teamRole: "owner" });
      const setting = await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: teamProject.id, autoTopUpEnabled: false });
      const { apiKey } = await seedApiKey({ userId: user.id, organizationId: team.id });

      const asOwner = await getDeploymentSetting(setting, { "x-api-key": apiKey });
      await db
        .update(resolveTable("OrganizationMembers"))
        .set({ role: "member" })
        .where(eq(resolveTable("OrganizationMembers").id, membership.id));
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

  async function seedWallet(userId: string | null, organizationId: string) {
    const [wallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId, organizationId, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();

    return wallet;
  }

  async function seedApiKey(input: { userId: string; organizationId: string; projectId?: string }) {
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

  async function setup(input: { teamRole?: OrganizationRole }) {
    const {
      user,
      organization: personal,
      project: personalProject
    } = await seedOrganizationWithOwner({
      type: "personal",
      user: { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}`, emailVerified: true }
    });
    const { user: teamOwner, organization: team, project: teamProject } = await seedOrganizationWithOwner();
    const membership = await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: input.teamRole ?? "admin" });
    const bearer = signIn(user.userId!);

    return { user, personal, personalProject, team, teamOwner, teamProject, membership, bearer };
  }
});
