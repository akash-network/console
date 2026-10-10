import { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Registry } from "@cosmjs/proto-signing";
import { and, eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import type { WalletListOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentListResponseSeed } from "@test/seeders/deployment-list-response.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { WalletTestingService } from "@test/services/wallet-testing.service";

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

    it("signs with the member's own derivation index while organizations are off for them", async () => {
      const { user, token, team, wallet, signedIndexes } = await setup({ organizationsOn: false });

      const response = await signTx(user.id, wallet.address, { authorization: `Bearer ${token}`, "x-organization-id": team.id });

      expect(response.status).toBe(200);
      expect(signedIndexes).toEqual([wallet.id]);
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

    const findTeamRows = async (dseq: string) => {
      const settings = resolveTable("DeploymentSettings");
      return await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .select()
        .from(settings)
        .where(and(eq(settings.organizationId, team.id), eq(settings.dseq, dseq)));
    };

    return { user, token, wallet, team, teamWallet: { ...teamWallet, address: teamWallet.address as string }, signedIndexes, findTeamRows };
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }
});
