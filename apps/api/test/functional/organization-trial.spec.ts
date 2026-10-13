import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { STANDARD_TOP_UP_MIN_AMOUNT_USD } from "@src/billing/config";
import type { WalletListOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { WalletTestingService } from "@test/services/wallet-testing.service";

describe("Organization trial", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("GET /v1/wallets", () => {
    it("answers for the active organization: a new team without a trial, the creator's personal organization with theirs", async () => {
      const { user, wallet, personal, authorization } = await setupTrialUser();
      const team = await createOrganization(authorization, "Acme Corp");

      const inTeam = await listWallets(user.id, { authorization, "x-organization-id": team.id });
      const inPersonal = await listWallets(user.id, { authorization, "x-organization-id": personal.id });
      const backInTeam = await listWallets(user.id, { authorization, "x-organization-id": team.id });

      expect(inTeam).toEqual([
        expect.objectContaining({
          userId: user.id,
          address: expect.stringMatching(/^akash1/),
          creditAmount: 0,
          isTrialing: false,
          trialEndsAt: null,
          trialDurationDays: null,
          topUpMinAmountUsd: STANDARD_TOP_UP_MIN_AMOUNT_USD
        })
      ]);
      expect(inTeam[0].id).not.toBe(wallet.id);
      expect(inPersonal).toEqual([
        expect.objectContaining({ id: wallet.id, address: wallet.address, isTrialing: true, trialEndsAt: expect.any(String), trialDurationDays: expect.any(Number) })
      ]);
      expect(backInTeam).toEqual(inTeam);
    });
  });

  describe("POST /v1/register-user", () => {
    it("files the caller's wallet into their personal organization while a team is active", async () => {
      const { user, personal, team, teamWallet, authorization } = await setupTeamMember();
      vi.spyOn(container.resolve(NotificationService), "createDefaultChannel").mockResolvedValue(undefined);

      const response = await app.request("/v1/register-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization, "x-organization-id": team.id },
        body: JSON.stringify({ wantedUsername: user.username, email: user.email, emailVerified: true, subscribedToNewsletter: false })
      });

      expect(response.status).toBe(200);
      expect(await findWalletsWhere(eq(resolveTable("UserWallets").userId, user.id))).toEqual([
        expect.objectContaining({ organizationId: personal.id, address: expect.stringMatching(/^akash1/) })
      ]);
      expect(await findWalletsWhere(eq(resolveTable("UserWallets").organizationId, team.id))).toEqual([
        expect.objectContaining({ id: teamWallet.id, isTrialing: false, activatedAt: null })
      ]);
    });
  });

  describe("POST /v1/tx", () => {
    it("asks a team's API key for payment before the team is funded, and leaves its wallet without a trial", async () => {
      const { user, team, teamWallet } = await setupTeamMember({ teamRole: "owner" });
      const apiKey = await seedApiKey({ userId: user.id, organizationId: team.id });

      const response = await signTx(user.id, teamWallet.address, { "x-api-key": apiKey });

      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ code: "insufficient_balance" });
      expect(await findWalletsWhere(eq(resolveTable("UserWallets").id, teamWallet.id))).toEqual([
        expect.objectContaining({ isTrialing: false, activatedAt: null, deploymentAllowance: "0.00", feeAllowance: "0.00" })
      ]);
    });

    it("holds the personal trial to the trial's rules and a funded team to none of them", async () => {
      const { user, wallet, authorization } = await setupTrialUser();
      const { organization: team } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "admin" });
      const teamWallet = await seedTeamWallet(team.id, { activatedAt: new Date() });
      await container.resolve(UserRepository).updateById(user.id, { fairUsePolicyAcceptedAt: null });
      answerFundedChain();

      const inPersonal = await signTx(user.id, wallet.address, { authorization });
      const inTeam = await signTx(user.id, teamWallet.address, { authorization, "x-organization-id": team.id });

      expect(inPersonal.status).toBe(403);
      expect(await inPersonal.json()).toMatchObject({ code: "fair_use_policy_required" });
      expect(inTeam.status).toBe(200);
    });
  });

  async function createOrganization(authorization: string, name: string) {
    const response = await app.request("/v1/organizations", {
      method: "POST",
      body: JSON.stringify({ data: { name } }),
      headers: { "Content-Type": "application/json", authorization }
    });
    expect(response.status).toBe(201);

    return ((await response.json()) as { data: { id: string } }).data;
  }

  async function listWallets(userId: string, headers: Record<string, string>) {
    const response = await app.request(`/v1/wallets?userId=${userId}`, { headers });
    expect(response.status).toBe(200);

    return ((await response.json()) as WalletListOutputResponse).data;
  }

  async function signTx(userId: string, owner: string, headers: Record<string, string>) {
    const message = { typeUrl: `/${MsgCreateDeployment.$type}`, value: MsgCreateDeployment.fromPartial({ id: { owner, dseq: faker.number.int({ min: 1, max: 1e9 }) } }) };

    return await app.request("/v1/tx", {
      method: "POST",
      body: JSON.stringify({
        data: { userId, messages: [{ typeUrl: message.typeUrl, value: Buffer.from(registry.encode(message)).toString("base64") }] }
      }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  async function findWalletsWhere(where: ReturnType<typeof eq>) {
    return await db.select().from(resolveTable("UserWallets")).where(where);
  }

  async function seedTeamWallet(organizationId: string, overrides: { activatedAt?: Date } = {}) {
    const [teamWallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId, address: createAkashAddress(), isTrialing: false, ...overrides })
      .returning();

    return { ...teamWallet, address: teamWallet.address as string };
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

  function answerFundedChain() {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(200, createFeeAllowanceResponse({ amount: "5000000" }))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, createDeploymentGrantResponseSeed({ amount: "5000000", grantType: "/akash.escrow.v1.DepositAuthorization" }));
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }

  async function setupTrialUser() {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances\/.*/)
      .once()
      .reply(200, { allowances: [createFeeAllowanceResponse()] });
    nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
      .persist()
      .post("/v1/tx/funding")
      .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } })
      .post("/v1/tx/derived")
      .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } });

    const { user, token, wallet } = await walletService.createUserAndWallet();
    const organizations = resolveTable("Organizations");
    const [personal] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.createdByUserId, user.id), eq(organizations.type, "personal")));
    enableOrganizationsFor([user.id]);

    return { user: user as { id: string }, wallet, personal, authorization: `Bearer ${token}` };
  }

  async function setupTeamMember(input: { teamRole?: "owner" | "member" } = {}) {
    const externalUserId = `auth0|${faker.string.alphanumeric(24)}`;
    const { user, organization: personal } = await seedOrganizationWithOwner({
      type: "personal",
      user: { userId: externalUserId, username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email().toLowerCase(), emailVerified: true }
    });
    const { organization: team } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: input.teamRole ?? "member" });
    const teamWallet = await seedTeamWallet(team.id);
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );
    enableOrganizationsFor([user.id]);

    return { user, personal, team, teamWallet, authorization: `Bearer ${token}` };
  }
});
