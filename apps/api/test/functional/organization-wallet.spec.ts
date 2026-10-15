import { certificateManager } from "@akashnetwork/chain-sdk";
import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Registry } from "@cosmjs/proto-signing";
import { and, eq } from "drizzle-orm";
import createError from "http-errors";
import nock from "nock";
import fs from "node:fs";
import path from "node:path";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import type { WalletListOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { GetSpendRateResponse } from "@src/deployment/http-schemas/deployment.schema";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { app } from "@src/rest-app";

import { createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createDeploymentListResponseSeed } from "@test/seeders/deployment-list-response.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { WalletTestingService } from "@test/services/wallet-testing.service";

const HELLO_WORLD_SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

describe("Organization wallet", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("GET /v1/wallets", () => {
    it("lists the team's wallet, ready to fund and without a trial, while the team is active", async () => {
      const { user, token, teamWallet, team } = await setup();

      const body = await listWallets(user.id, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(body.data).toEqual([expect.objectContaining({ id: teamWallet.id, userId: user.id, address: teamWallet.address, isTrialing: false })]);
    });

    it("lists the member's own wallet while their personal organization is active", async () => {
      const { user, token, wallet } = await setup();

      const body = await listWallets(user.id, { authorization: `Bearer ${token}` });

      expect(body.data).toEqual([expect.objectContaining({ id: wallet.id, userId: user.id, address: wallet.address, isTrialing: true })]);
    });

    it("keeps listing the member's own wallet while organizations are off for them", async () => {
      const { user, token, wallet, team } = await setup({ organizationsOn: false });

      const body = await listWallets(user.id, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(body.data).toEqual([expect.objectContaining({ id: wallet.id, address: wallet.address })]);
    });
  });

  describe("GET /v1/balances", () => {
    it("reads the team wallet's balances while the team is active", async () => {
      const { token, team, teamWallet, wallet } = await setup();
      answerDeploymentEscrow({ [teamWallet.address]: "7000000", [wallet.address]: "1000000" });

      const response = await app.request("/v1/balances", { headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { deployments: 7000000 } });
    });

    it("reads the member's own balances while organizations are off for them", async () => {
      const { token, team, teamWallet, wallet } = await setup({ organizationsOn: false });
      answerDeploymentEscrow({ [teamWallet.address]: "7000000", [wallet.address]: "1000000" });

      const response = await app.request("/v1/balances", { headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { deployments: 1000000 } });
    });
  });

  describe("POST /v1/tx", () => {
    it("signs with the team wallet's derivation index while the team is active", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup();

      const response = await signTx(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(signedIndexes).toEqual([teamWallet.id]);
    });

    it("refuses a message that acts for another wallet than the active team's", async () => {
      const { user, token, team, wallet, signedIndexes } = await setup();

      const response = await signTx(user.id, wallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "message_signer_mismatch" });
      expect(signedIndexes).toEqual([]);
    });

    it("refuses to sign for another user than the one authenticated", async () => {
      const { token, team, teamWallet, signedIndexes } = await setup();

      const response = await signTx(team.createdByUserId!, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(404);
      expect(signedIndexes).toEqual([]);
    });

    it("refuses a viewer, who may not sign with the team wallet", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "viewer" });

      const response = await signTx(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(403);
      expect(signedIndexes).toEqual([]);
    });

    it("refuses a member limited to one project who closes a deployment filed in another", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "member" });
      const [granted, other] = await Promise.all([seedProject({ organizationId: team.id }), seedProject({ organizationId: team.id })]);
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id });
      await seedDeploymentSetting({ userId: team.createdByUserId!, organizationId: team.id, projectId: other.id, dseq: "123" });

      const response = await signTx(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "project_forbidden" });
      expect(signedIndexes).toEqual([]);
    });

    it("lets a member limited to one project close a deployment filed in it", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "member" });
      const granted = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id });
      await seedDeploymentSetting({ userId: team.createdByUserId!, organizationId: team.id, projectId: granted.id, dseq: "123" });

      const response = await signTx(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(signedIndexes).toEqual([teamWallet.id]);
    });

    it("refuses a member whose grant on the deployment's project only lets them view it", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "member" });
      const granted = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id, role: "viewer" });
      await seedDeploymentSetting({ userId: team.createdByUserId!, organizationId: team.id, projectId: granted.id, dseq: "123" });

      const response = await signTx(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "project_forbidden" });
      expect(signedIndexes).toEqual([]);
    });

    it("signs with the member's own derivation index while organizations are off for them", async () => {
      const { user, token, team, wallet, signedIndexes } = await setup({ organizationsOn: false });

      const response = await signTx(user.id, wallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(signedIndexes).toEqual([wallet.id]);
    });

    it("refuses a certificate for the team wallet to a member limited to one project, since it would reach every project", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "member" });
      const granted = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id });

      const response = await createCertificate(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "project_forbidden" });
      expect(signedIndexes).toEqual([]);
    });

    it("refuses a certificate for the team wallet to an admin whose request is narrowed to one project", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "admin" });
      const project = await seedProject({ organizationId: team.id });

      const response = await createCertificate(user.id, teamWallet.address, {
        authorization: `Bearer ${token}`,
        "x-organization-id": team.id,
        "x-project-id": project.id
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "project_forbidden" });
      expect(signedIndexes).toEqual([]);
    });

    it("creates a certificate for the team wallet for an admin, who reaches every project", async () => {
      const { user, token, team, teamWallet, signedIndexes } = await setup({ role: "admin" });

      const response = await createCertificate(user.id, teamWallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(signedIndexes).toEqual([teamWallet.id]);
    });

    it("creates a certificate for a member's own wallet while organizations are off for them", async () => {
      const { user, token, team, wallet, signedIndexes } = await setup({ role: "member", organizationsOn: false });

      const response = await createCertificate(user.id, wallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(signedIndexes).toEqual([wallet.id]);
    });
  });

  describe("reading deployments as an organization viewer", () => {
    it("reads a deployment filed in a granted project and the list, and may not create one", async () => {
      const { token, team, teamWallet } = await setupFiledDeployments({ role: "viewer" });
      const headers = { authorization: `Bearer ${token}`, "x-organization-id": team.id };

      const one = await app.request("/v1/deployments/123", { headers });
      const list = await app.request("/v1/deployments?skip=0&limit=10", { headers });
      const create = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({ data: { sdl: "version: '2.0'" } }),
        headers: { "Content-Type": "application/json", ...headers }
      });

      expect(one.status).toBe(200);
      expect(await one.json()).toMatchObject({ data: { deployment: { id: { owner: teamWallet.address, dseq: "123" } } } });
      expect(list.status).toBe(200);
      expect(create.status).toBe(403);
    });

    it("answers not found for a deployment filed in a project the viewer was not granted", async () => {
      const { token, team } = await setupFiledDeployments({ role: "viewer" });

      const response = await app.request("/v1/deployments/456", { headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id } });

      expect(response.status).toBe(404);
    });

    it("shows the spend rate of deployments in granted projects only", async () => {
      const { token, team, teamWallet } = await setupFiledDeployments({ role: "viewer" });
      await Promise.all(["123", "456"].map(dseq => seedLiveLease(teamWallet.address, dseq)));

      const response = await app.request("/v1/spend-rate", { headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id } });

      expect(response.status).toBe(200);
      expect(((await response.json()) as GetSpendRateResponse).data.deployments.map(({ dseq }) => dseq)).toEqual(["123"]);
    });
  });

  describe("reading deployments as a billing member", () => {
    it("is refused a deployment and lists none", async () => {
      const { token, team } = await setupFiledDeployments({ role: "billing" });
      const headers = { authorization: `Bearer ${token}`, "x-organization-id": team.id };

      const one = await app.request("/v1/deployments/123", { headers });
      const list = await app.request("/v1/deployments?skip=0&limit=10", { headers });

      expect(one.status).toBe(403);
      expect(list.status).toBe(200);
      expect(((await list.json()) as { data: { deployments: unknown[] } }).data.deployments).toEqual([]);
    });
  });

  describe("POST /v1/deployments inheriting secrets", () => {
    it("answers not found for a source filed in a project the member was not granted", async () => {
      const { token, team } = await setupFiledDeployments({ role: "member" });

      const response = await createInheriting("456", { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ message: "No deployment was found to inherit secrets from" });
    });

    it("opens a source another member filed in a granted project under that member", async () => {
      const { token, team } = await setupFiledDeployments({ role: "member" });
      const openStored = vi.spyOn(container.resolve(SdlSecretsService), "openStored").mockResolvedValue({ API_TOKEN: "carried" });
      vi.spyOn(container.resolve(ManagedSignerService), "assertCanBroadcast").mockRejectedValue(createError(402, "stop after inheriting"));

      const response = await createInheriting("123", { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(openStored).toHaveBeenCalledWith({ userId: team.createdByUserId, dseq: "123", sealedSecrets: "sealed.token" });
      expect(response.status).toBe(402);
    });
  });

  describe("PUT /v1/deployments/{dseq}", () => {
    it("refuses a caller narrowed to one project of their personal organization who updates a deployment filed in another, writing nothing", async () => {
      const { user, token, findRowsOf } = await setup();
      const personal = await container.resolve(OrganizationRepository).findPersonalByUserId(user.id);
      const defaultProject = await container
        .resolve(ProjectRepository)
        .unscoped("personal-organization-provisioning")
        .findDefaultByOrganizationId(personal!.id);
      const otherProject = await seedProject({ organizationId: personal!.id });
      await seedDeploymentSetting({ userId: user.id, organizationId: personal!.id, projectId: defaultProject!.id, dseq: "123", sdl: "version: '2.0'" });

      const response = await app.request("/v1/deployments/123", {
        method: "PUT",
        body: JSON.stringify({ data: { sdl: "version: '2.0'\nservices: {}" } }),
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}`, "x-organization-id": personal!.id, "x-project-id": otherProject.id }
      });

      expect(response.status).toBe(403);
      expect(await findRowsOf(personal!.id, "123")).toEqual([expect.objectContaining({ sdl: "version: '2.0'" })]);
    });
  });

  describe("POST /v1/create-jwt-token", () => {
    it("refuses a token meant to outlive an hour to a caller narrowed to one project", async () => {
      const { user, token } = await setup();
      const personal = await container.resolve(OrganizationRepository).findPersonalByUserId(user.id);
      const project = await seedProject({ organizationId: personal!.id });

      const response = await app.request("/v1/create-jwt-token", {
        method: "POST",
        body: JSON.stringify({
          data: {
            ttl: 7200,
            leases: { access: "granular", permissions: [{ provider: createAkashAddress(), access: "granular", deployments: [{ dseq: 123, scope: ["logs"] }] }] }
          }
        }),
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}`, "x-organization-id": personal!.id, "x-project-id": project.id }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ message: "ttl must be at most 3600 seconds" });
    });
  });

  describe("PATCH /v2/deployment-settings/{dseq}", () => {
    it("changes the one row a team deployment was filed under when another member changes it", async () => {
      const { token, team, findTeamRows } = await setup();
      await seedDeploymentSetting({ userId: team.createdByUserId!, organizationId: team.id, dseq: "123", autoTopUpEnabled: true });

      const response = await patchSetting("123", { closeReason: "no_longer_needed" }, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(await findTeamRows("123")).toEqual([expect.objectContaining({ userId: team.createdByUserId, closeReason: "no_longer_needed" })]);
    });

    it("refuses a member limited to one project who changes a deployment filed in another, filing nothing", async () => {
      const { user, token, team, findTeamRows } = await setup({ role: "member" });
      const [granted, other] = await Promise.all([seedProject({ organizationId: team.id }), seedProject({ organizationId: team.id })]);
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id });
      await seedDeploymentSetting({ userId: team.createdByUserId!, organizationId: team.id, projectId: other.id, dseq: "123", autoTopUpEnabled: true });

      const response = await patchSetting("123", { closeReason: "no_longer_needed" }, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(404);
      expect(await findTeamRows("123")).toEqual([expect.objectContaining({ userId: team.createdByUserId, closeReason: null })]);
    });
  });

  async function patchSetting(dseq: string, data: Record<string, unknown>, headers: Record<string, string>) {
    return await app.request(`/v2/deployment-settings/${dseq}`, {
      method: "PATCH",
      body: JSON.stringify({ data }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  async function listWallets(userId: string, headers: Record<string, string>) {
    const response = await app.request(`/v1/wallets?userId=${userId}`, { headers });
    expect(response.status).toBe(200);

    return (await response.json()) as WalletListOutputResponse;
  }

  async function signTx(userId: string, owner: string, headers: Record<string, string>) {
    const message = { typeUrl: `/${MsgCloseDeployment.$type}`, value: MsgCloseDeployment.fromPartial({ id: { owner, dseq: 123 } }) };

    return await app.request("/v1/tx", {
      method: "POST",
      body: JSON.stringify({
        data: { userId, messages: [{ typeUrl: message.typeUrl, value: Buffer.from(registry.encode(message)).toString("base64") }] }
      }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  async function createCertificate(userId: string, owner: string, headers: Record<string, string>) {
    const { cert, publicKey } = await certificateManager.generatePEM(owner);
    const message = {
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({ owner, cert: Buffer.from(cert), pubkey: Buffer.from(publicKey) })
    };

    return await app.request("/v1/tx", {
      method: "POST",
      body: JSON.stringify({
        data: { userId, messages: [{ typeUrl: message.typeUrl, value: Buffer.from(registry.encode(message)).toString("base64") }] }
      }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  function answerDeploymentEscrow(amountByOwner: Record<string, string>) {
    const restApi = nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL).persist();

    for (const [owner, amount] of Object.entries(amountByOwner)) {
      restApi
        .get(uri => uri.includes("/deployments/list") && uri.includes(owner))
        .reply(200, createDeploymentListResponseSeed({ owner, amount }))
        .get(uri => uri.includes("/cosmos/bank/v1beta1/balances") && uri.includes(owner))
        .reply(200, { balances: [], pagination: { next_key: null, total: "0" } });
    }
  }

  async function setup(input: { organizationsOn?: boolean; role?: OrganizationRole } = {}) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances\/.*/)
      .once()
      .reply(200, { allowances: [createFeeAllowanceResponse()] });
    const signedIndexes: number[] = [];
    nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
      .persist()
      .post("/v1/tx/funding")
      .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } })
      .post("/v1/tx/derived", body => {
        signedIndexes.push(body.data.derivationIndex);
        return true;
      })
      .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } });

    const { user, token, wallet } = await walletService.createUserAndWallet();
    const { organization: team } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: input.role ?? "admin" });
    const [teamWallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: team.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(200, createFeeAllowanceResponse({ amount: "5000000" }))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, createDeploymentGrantResponseSeed({ amount: "5000000", grantType: "/akash.escrow.v1.DepositAuthorization" }));

    enableOrganizationsFor(input.organizationsOn === false ? [] : [user.id]);

    const findRowsOf = async (organizationId: string, dseq: string) => {
      const settings = resolveTable("DeploymentSettings");
      return await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .select()
        .from(settings)
        .where(and(eq(settings.organizationId, organizationId), eq(settings.dseq, dseq)));
    };
    const findTeamRows = async (dseq: string) => await findRowsOf(team.id, dseq);

    return { user, token, wallet, team, teamWallet: { ...teamWallet, address: teamWallet.address as string }, signedIndexes, findTeamRows, findRowsOf };
  }

  async function setupFiledDeployments(input: { role: OrganizationRole }) {
    const context = await setup({ role: input.role });
    const [granted, other] = await Promise.all([seedProject({ organizationId: context.team.id }), seedProject({ organizationId: context.team.id })]);
    await seedProjectMember({
      organizationId: context.team.id,
      projectId: granted.id,
      userId: context.user.id,
      role: input.role === "viewer" ? "viewer" : "member"
    });
    await Promise.all([
      seedDeploymentSetting({
        userId: context.team.createdByUserId!,
        organizationId: context.team.id,
        projectId: granted.id,
        dseq: "123",
        sealedSecrets: "sealed.token"
      }),
      seedDeploymentSetting({
        userId: context.team.createdByUserId!,
        organizationId: context.team.id,
        projectId: other.id,
        dseq: "456",
        sealedSecrets: "sealed.token"
      })
    ]);
    const owner = context.teamWallet.address;
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(uri => uri.includes("/deployments/info") && uri.includes(owner))
      .reply(200, createDeploymentInfoSeed({ owner, dseq: "123" }))
      .get(uri => uri.includes("/deployments/list") && uri.includes(owner))
      .reply(200, createDeploymentListResponseSeed({ owner }))
      .get(uri => uri.includes("/leases/list") && uri.includes(owner))
      .reply(200, { leases: [], pagination: { next_key: null, total: "0" } });

    return context;
  }

  async function seedLiveLease(owner: string, dseq: string) {
    const deployment = await createDeployment({ owner, dseq });
    const provider = await createProvider();
    const group = await createDeploymentGroup({ deploymentId: deployment.id, owner, dseq, gseq: 1 });
    await createLease({
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      owner,
      dseq,
      gseq: 1,
      oseq: 1,
      providerAddress: provider.owner,
      price: 1,
      denom: "uact"
    });
  }

  async function createInheriting(source: string, headers: Record<string, string>) {
    return await app.request("/v1/deployments", {
      method: "POST",
      body: JSON.stringify({ data: { sdl: HELLO_WORLD_SDL, inheritSecretsFrom: source } }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }
});
