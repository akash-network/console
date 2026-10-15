import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { type ApiPgDatabase, CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { createInvitationToken, hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { TeamOrganizationDeleted } from "@src/organization/services/team-organization-deleted/team-organization-deleted.handler";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationInvitation, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { findJobRows } from "@test/services/job-queue-harness";
import { holdTransaction, waitForLockWait } from "@test/services/lock-wait";

describe("Organization deletion", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("DELETE /v1/organizations/{id}", () => {
    it("lets an owner delete the active team, keeping what it paid and deployed, and queues its cleanup", async () => {
      const { team, owner, wallet, deleteTeam } = await setup();
      const transaction = await seedTransaction(team.id, owner.id);
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id });
      const setting = await seedWalletSetting({ userId: owner.id, walletId: wallet.id, organizationId: team.id, autoReloadEnabled: true });
      await seedPaymentMethod(team.id, owner.id);

      const response = await deleteTeam(owner);

      expect(response.status).toBe(204);
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: expect.any(Date) })]);
      expect(await rowsOf("StripeTransactions", transaction.id)).toHaveLength(1);
      expect(await rowsOf("DeploymentSettings", deployment.id)).toHaveLength(1);
      expect(await rowsOf("WalletSetting", setting.id)).toEqual([expect.objectContaining({ autoReloadEnabled: false })]);
      expect(await paymentMethodsOf(team.id)).toEqual([]);
      expect(await findJobRows(TeamOrganizationDeleted[JOB_NAME], { data: { organizationId: team.id } })).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ organizationId: team.id, deletedByUserId: owner.id }) })
      ]);
    });

    it("takes the team away from its members right away, landing a member who last used it on their personal organization", async () => {
      const { team, owner, member, deleteTeam, request } = await setup();
      await db
        .update(resolveTable("Users"))
        .set({ lastUsedOrganizationId: team.id })
        .where(eq(resolveTable("Users").id, member.id));

      await deleteTeam(owner);
      const inTeam = await request(member, "/v1/organizations", { "x-organization-id": team.id });
      const withoutHeader = await request(member, "/v1/organizations");

      expect(inTeam.status).toBe(403);
      expect(await inTeam.json()).toMatchObject({ code: "organization_forbidden" });
      expect(withoutHeader.status).toBe(200);
      const { data } = (await withoutHeader.json()) as { data: { id: string; type: string; isActive: boolean }[] };
      expect(data).toEqual([expect.objectContaining({ type: "personal", isActive: true })]);
    });

    it("stops the team's API keys from working", async () => {
      const { team, owner, member, deleteTeam } = await setup();
      const apiKey = await seedApiKey(member.id, team.id);

      await deleteTeam(owner);
      const response = await app.request("/v1/organizations", { headers: { "x-api-key": apiKey } });

      expect(response.status).toBe(401);
    });

    it("makes the team's pending invitations unusable", async () => {
      const { team, owner, deleteTeam } = await setup();
      const token = createInvitationToken();
      const invitation = await seedOrganizationInvitation({ organizationId: team.id, invitedByUserId: owner.id, tokenHash: hashInvitationToken(token) });

      await deleteTeam(owner);
      const preview = await app.request("/v1/invitations/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { token } })
      });

      expect(preview.status).toBe(404);
      expect(await rowsOf("OrganizationInvitations", invitation.id)).toEqual([expect.objectContaining({ status: "revoked", revokedAt: expect.any(Date) })]);
    });

    it("refuses while a deployment of the team is running, naming it", async () => {
      const walletAddress = createAkashAddress();
      const deployment = createDeploymentInfoSeed({ owner: walletAddress, state: "active" });
      const { team, owner, deleteTeam } = await setup({ walletAddress, deployments: [deployment] });

      const response = await deleteTeam(owner);

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "active_deployments",
        data: { activeDeploymentCount: 1, dseqs: [deployment.deployment.id.dseq] }
      });
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it("refuses to forfeit more credits than the owner acknowledged, telling the balance, and deletes once they acknowledge it all", async () => {
      const { team, owner, deleteTeam } = await setup({ balanceUakt: "12500000" });

      const unacknowledged = await deleteTeam(owner);
      const underAcknowledged = await deleteTeam(owner, { acknowledgedForfeitUsd: "12" });
      const acknowledged = await deleteTeam(owner, { acknowledgedForfeitUsd: "12.5" });

      for (const refused of [unacknowledged, underAcknowledged]) {
        expect(refused.status).toBe(400);
        expect(await refused.json()).toMatchObject({ code: "forfeit_acknowledgement_required", data: { balanceUsd: 12.5 } });
      }
      expect(acknowledged.status).toBe(204);
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: expect.any(Date) })]);
    });

    it("waits for a card payment settling into the team's wallet, then refuses to forfeit the credits it added", async () => {
      const { team, owner, wallet, chain, deleteTeam } = await setup({ balanceUakt: "12500000" });
      const settlement = holdTransaction(async () => {
        await container.resolve(UserWalletRepository).findOneByAndLock({ id: wallet.id });
      });
      await settlement.held;

      const deleting = deleteTeam(owner, { acknowledgedForfeitUsd: "12.5" });
      await waitForLockWait('select %from "user_wallets"%for update');
      chain.balanceUakt = "32500000";
      settlement.release();
      await settlement.committed;
      const response = await deleting;

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "forfeit_acknowledgement_required", data: { balanceUsd: 32.5 } });
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it("waits for a deposit being recorded for the team, then refuses while the chain may still include it", async () => {
      const { team, owner, wallet, deleteTeam } = await setup();
      const dseq = faker.string.numeric(8);
      const recording = holdTransaction(async () => {
        await container
          .resolve(DeploymentDepositRepository)
          .createMany([
            { organizationId: team.id, owner: wallet.address, dseq, kind: "deployment_create", amount: "5000000", denom: "uact", amountCents: 500 }
          ]);
      });
      await recording.held;

      const deleting = deleteTeam(owner);
      await waitForLockWait('select %from "organizations"%for update');
      recording.release();
      await recording.committed;
      const response = await deleting;

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "active_deployments", data: { activeDeploymentCount: 1, dseqs: [dseq] } });
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it.each<OrganizationRole>(["admin", "member", "billing", "viewer"])("refuses a caller who is a team %s", async role => {
      const { team, member, deleteTeam } = await setup({ memberRole: role });

      const response = await deleteTeam(member);

      expect(response.status).toBe(403);
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it("refuses to delete a personal organization on its own", async () => {
      const { owner, request } = await setup();
      const personal = await seedOrganization({ type: "personal", createdByUserId: owner.id });
      await seedOrganizationMember({ organizationId: personal.id, userId: owner.id, role: "owner" });

      const response = await request(owner, `/v1/organizations/${personal.id}`, { "x-organization-id": personal.id }, "DELETE");

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "personal_organization" });
      expect(await rowsOf("Organizations", personal.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it("refuses an owner's API key", async () => {
      const { team, owner } = await setup();
      const apiKey = await seedApiKey(owner.id, team.id);

      const response = await app.request(`/v1/organizations/${team.id}`, { method: "DELETE", headers: { "x-api-key": apiKey } });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it("answers not found for a team of the caller other than the active one", async () => {
      const { team, owner, request } = await setup();

      const response = await request(owner, `/v1/organizations/${team.id}`, {}, "DELETE");

      expect(response.status).toBe(404);
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { team, owner, deleteTeam } = await setup({ organizationsOn: false });

      const response = await deleteTeam(owner);

      expect(response.status).toBe(404);
      expect(await rowsOf("Organizations", team.id)).toEqual([expect.objectContaining({ deletedAt: null })]);
    });
  });

  async function rowsOf(table: "Organizations" | "StripeTransactions" | "DeploymentSettings" | "WalletSetting" | "OrganizationInvitations", id: string) {
    const resolved = resolveTable(table);

    return await db.select().from(resolved).where(eq(resolved.id, id));
  }

  async function paymentMethodsOf(organizationId: string) {
    const table = resolveTable("PaymentMethods");

    return await db.select().from(table).where(eq(table.organizationId, organizationId));
  }

  async function seedTransaction(organizationId: string, userId: string) {
    const [transaction] = await db
      .insert(resolveTable("StripeTransactions"))
      .values({ type: "payment_intent", status: "succeeded", amount: 2000, currency: "usd", organizationId, userId })
      .returning();

    return transaction;
  }

  async function seedPaymentMethod(organizationId: string, userId: string) {
    await db.insert(resolveTable("PaymentMethods")).values({
      organizationId,
      userId,
      fingerprint: faker.string.alphanumeric(16),
      paymentMethodId: `pm_${faker.string.alphanumeric(14)}`,
      isDefault: true,
      isValidated: true
    });
  }

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

  function answerChain(address: string, input: { deployments?: ReturnType<typeof createDeploymentInfoSeed>[]; balanceUakt?: string } = {}) {
    const deployments = input.deployments ?? [];
    const chain = { balanceUakt: input.balanceUakt };
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/akash/deployment/v1beta4/deployments/list")
      .query(true)
      .reply(200, { deployments, pagination: { next_key: null, total: String(deployments.length) } })
      .get(uri => uri.includes("/cosmos/authz/v1beta1/grants") && uri.includes(address))
      .reply(() => [
        200,
        chain.balanceUakt
          ? createDeploymentGrantResponseSeed({ grantee: address, amount: chain.balanceUakt, grantType: "/akash.escrow.v1.DepositAuthorization" })
          : { grants: [], pagination: { next_key: null, total: "0" } }
      ]);

    return chain;
  }

  async function setup(
    input: {
      memberRole?: OrganizationRole;
      organizationsOn?: boolean;
      walletAddress?: string;
      deployments?: ReturnType<typeof createDeploymentInfoSeed>[];
      balanceUakt?: string;
    } = {}
  ) {
    const tokens = new Map<string, string>();
    const signedInUser = () => ({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: signedInUser() });
    const member = await seedUser(signedInUser());
    await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: input.memberRole ?? "member" });
    const [wallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: team.id, address: input.walletAddress ?? createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();
    const enabledUserIds = input.organizationsOn === false ? [] : [owner.id, member.id];

    for (const user of [owner, member]) {
      tokens.set(user.id, faker.string.alphanumeric(40));
    }
    const externalUserIdByToken = new Map([...tokens].map(([id, token]) => [token, id === owner.id ? owner.userId! : member.userId!]));
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => externalUserIdByToken.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return enabledUserIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
    vi.spyOn(container.resolve(DenomExchangeService), "getExchangeRateToUSD").mockResolvedValue({
      price: 1,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    });
    const chain = answerChain(wallet.address!, input);

    async function request(user: Pick<UserOutput, "id">, path: string, headers: Record<string, string> = {}, method = "GET") {
      return await app.request(path, { method, headers: { authorization: `Bearer ${tokens.get(user.id)}`, ...headers } });
    }

    async function deleteTeam(user: Pick<UserOutput, "id">, query: Record<string, string> = {}) {
      const search = new URLSearchParams(query).toString();

      return await request(user, `/v1/organizations/${team.id}${search ? `?${search}` : ""}`, { "x-organization-id": team.id }, "DELETE");
    }

    return { team, owner, member, wallet: { ...wallet, address: wallet.address! }, chain, request, deleteTeam };
  }
});
