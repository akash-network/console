import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import { addMinutes, subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { type ApiPgDatabase, CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";
import { AccountDeletionTokenRepository } from "@src/user/repositories/account-deletion-token/account-deletion-token.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { PurgeDeletedAccount } from "@src/user/services/purge-deleted-account/purge-deleted-account.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

interface ErrorBody {
  code: string;
  data?: Record<string, unknown>;
}

const STRIPE_API = "https://api.stripe.com";

describe("Account deletion", () => {
  const userRepository = container.resolve(UserRepository);
  const tokenRepository = container.resolve(AccountDeletionTokenRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

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

  describe("POST /v1/user/me/initiate-deletion", () => {
    it("returns 401 when the user is not authenticated", async () => {
      const response = await initiate({}, { forfeitAcknowledged: false });

      expect(response.status).toBe(401);
    });

    it("refuses a request authenticated with an API key", async () => {
      const { user } = await setupSignedInUser();
      const apiKey = await seedApiKey(user.id);

      const response = await initiate({ "x-api-key": apiKey }, { forfeitAcknowledged: false });

      expect(response.status).toBe(403);
      expect(((await response.json()) as ErrorBody).code).toBe("session_required");
      expect(await tokenRepository.findByUserId(user.id)).toBeUndefined();
    });

    it("emails a confirmation link whose token it stores only as a hash", async () => {
      const { user, token } = await setupSignedInUser();
      const sentNotifications = interceptNotifications();

      const response = await initiate({ authorization: `Bearer ${token}` }, { forfeitAcknowledged: false });

      expect(response.status).toBe(204);
      expect(sentNotifications).toHaveLength(1);
      const confirmUrl = new URL(sentNotifications[0].payload.actions[0].url);
      expect(confirmUrl.pathname).toBe("/user/confirm-delete");
      expect(confirmUrl.search).toBe("");
      const linkToken = new URLSearchParams(confirmUrl.hash.slice(1)).get("token")!;
      expect(await tokenRepository.findByUserId(user.id)).toMatchObject({ tokenHash: sha256(linkToken), acknowledgedForfeitUsd: 0 });
    });

    it("refuses an account with active deployments and names them", async () => {
      const { user, token, address } = await setupSignedInUser({ withWallet: true });
      const deployment = createDeploymentInfoSeed({ owner: address, state: "active" });
      answerActiveDeployments([deployment]);

      const response = await initiate({ authorization: `Bearer ${token}` }, { forfeitAcknowledged: true });
      const body = (await response.json()) as ErrorBody;

      expect(response.status).toBe(409);
      expect(body.code).toBe("active_deployments");
      expect(body.data).toEqual({ activeDeploymentCount: 1, dseqs: [deployment.deployment.id.dseq] });
      expect(await tokenRepository.findByUserId(user.id)).toBeUndefined();
    });

    it("refuses another link within a minute of the last one", async () => {
      const { user, token } = await setupSignedInUser();
      await tokenRepository.replaceForUser({
        userId: user.id,
        tokenHash: sha256(faker.string.alphanumeric(43)),
        acknowledgedForfeitUsd: 0,
        expiresAt: addMinutes(new Date(), 15)
      });

      const response = await initiate({ authorization: `Bearer ${token}` }, { forfeitAcknowledged: false });

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    });
  });

  describe("POST /v1/user/me/confirm-deletion", () => {
    it("deletes the account the link was issued for and queues the cleanup of its external records", async () => {
      const { user, linkToken } = await setupIssuedLink();

      const response = await confirm(linkToken);

      expect(response.status).toBe(204);
      expect(await userRepository.findById(user.id)).toBeUndefined();
      expect(await findJobRows(PurgeDeletedAccount[JOB_NAME], { data: { userId: user.id } })).toHaveLength(1);
    });

    it("refuses a token no link was issued for", async () => {
      const response = await confirm(faker.string.alphanumeric(43));

      expect(response.status).toBe(400);
      expect(((await response.json()) as ErrorBody).code).toBe("invalid_deletion_token");
    });

    it("refuses an expired link and keeps the account", async () => {
      const { user, linkToken } = await setupIssuedLink({ expiresAt: subMinutes(new Date(), 1) });

      const response = await confirm(linkToken);

      expect(response.status).toBe(400);
      expect(((await response.json()) as ErrorBody).code).toBe("expired_deletion_token");
      expect(await userRepository.findById(user.id)).toBeDefined();
    });
  });

  describe("for a member of a team organization", () => {
    it("keeps the team's history, refunds and late payments of what the deleted member paid", async () => {
      const { team, owner, member, teamCustomerId, teamWallet, headersOf, seedTransaction } = await setupTeam();
      const refunded = await seedTransaction({ userId: member.id, status: "succeeded", stripeChargeId: `ch_${faker.string.alphanumeric(14)}` });
      const pending = await seedTransaction({ userId: member.id, status: "pending" });
      const { linkToken } = await issueLinkFor(member.id);
      answerActiveDeployments([]);

      expect((await confirm(linkToken)).status).toBe(204);

      const historyResponse = await app.request("/v1/stripe/transactions", { headers: headersOf(owner) });
      expect(historyResponse.status).toBe(200);
      const { data } = (await historyResponse.json()) as { data: { transactions: { id: string; initiatedBy: unknown }[] } };
      expect(data.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: refunded.id, initiatedBy: null }),
          expect.objectContaining({ id: pending.id, initiatedBy: null })
        ])
      );

      const grantees = answerChainFor(teamWallet.address);
      const refundResponse = await sendWebhook({
        type: "charge.refunded",
        data: { object: { id: refunded.stripeChargeId, customer: teamCustomerId, amount_refunded: refunded.amount, refunded: true } }
      });
      expect(refundResponse.status).toBe(200);
      expect(await findTransaction(refunded.id)).toMatchObject({ status: "refunded", amountRefunded: refunded.amount, userId: null });

      nock(STRIPE_API).get("/v1/charges/ch_late").reply(200, { id: "ch_late", object: "charge", payment_method_details: null });
      const settlementResponse = await sendWebhook({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: `pi_${faker.string.alphanumeric(14)}`,
            object: "payment_intent",
            customer: teamCustomerId,
            amount: pending.amount,
            amount_received: pending.amount,
            latest_charge: "ch_late",
            payment_method_types: ["card"],
            metadata: { internal_transaction_id: pending.id }
          }
        }
      });
      expect(settlementResponse.status).toBe(200);
      expect(await findTransaction(pending.id)).toMatchObject({ status: "succeeded", organizationId: team.id, userId: null, bonusAmount: 0 });
      expect(new Set(grantees)).toEqual(new Set([teamWallet.address]));
    });

    it("refuses the last owner of the team when the link is requested and again when it is used", async () => {
      const { team, owner, headersOf } = await setupTeam();
      interceptNotifications();
      answerActiveDeployments([]);

      const initiateResponse = await initiate(headersOf(owner), { forfeitAcknowledged: true });
      const { linkToken } = await issueLinkFor(owner.id);
      const confirmResponse = await confirm(linkToken);

      expect(initiateResponse.status).toBe(409);
      expect(await initiateResponse.json()).toMatchObject({ code: "last_owner", data: { organizations: [{ id: team.id, name: team.name }] } });
      expect(confirmResponse.status).toBe(409);
      expect(((await confirmResponse.json()) as ErrorBody).code).toBe("last_owner");
      expect(await userRepository.findById(owner.id)).toBeDefined();
    });

    async function setupTeam() {
      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
      const member = await seedUser({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: "billing" });
      const teamCustomerId = `cus_${faker.string.alphanumeric(14)}`;
      await db
        .update(resolveTable("Organizations"))
        .set({ stripeCustomerId: teamCustomerId })
        .where(eq(resolveTable("Organizations").id, team.id));
      const [teamWallet] = await db
        .insert(resolveTable("UserWallets"))
        .values({ userId: null, organizationId: team.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
        .returning();

      const tokens = new Map<string, string>();
      const tokenOf = (user: { id: string; userId: string | null }) => {
        const token = faker.string.alphanumeric(40);
        tokens.set(token, user.userId!);
        return token;
      };
      const ownerToken = tokenOf(owner);
      vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null);
      vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
        if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
        if (flag !== FeatureFlags.ORGANIZATIONS) return true;

        return (context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id) === owner.id;
      });

      const headersOf = (user: { id: string }) => ({ authorization: `Bearer ${user.id === owner.id ? ownerToken : ""}`, "x-organization-id": team.id });
      const seedTransaction = async (input: { userId: string; status: "pending" | "succeeded"; stripeChargeId?: string }) => {
        const [transaction] = await db
          .insert(resolveTable("StripeTransactions"))
          .values({ type: "payment_intent", amount: 2000, currency: "usd", organizationId: team.id, ...input })
          .returning();
        return transaction;
      };

      return { team, owner, member, teamCustomerId, teamWallet: { ...teamWallet, address: teamWallet.address! }, headersOf, seedTransaction };
    }

    async function issueLinkFor(userId: string) {
      const linkToken = faker.string.alphanumeric(43);
      await tokenRepository.replaceForUser({ userId, tokenHash: sha256(linkToken), acknowledgedForfeitUsd: 0, expiresAt: addMinutes(new Date(), 15) });

      return { linkToken };
    }

    async function findTransaction(id: string) {
      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      return await db.query.StripeTransactions.findFirst({ where: eq(resolveTable("StripeTransactions").id, id) });
    }

    async function sendWebhook(event: Record<string, unknown>) {
      vi.spyOn(container.resolve(DomainEventsService), "publish").mockResolvedValue(null);
      const payload = JSON.stringify({ id: `evt_${faker.string.alphanumeric(14)}`, ...event });

      return await app.request("/v1/stripe-webhook", {
        method: "POST",
        body: payload,
        headers: {
          "Content-Type": "text/plain",
          "Stripe-Signature": stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! })
        }
      });
    }

    function answerChainFor(address: string) {
      const registry = container.resolve<Registry>(TYPE_REGISTRY);
      const grantees: string[] = [];
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .persist()
        .get(uri => uri.includes("/cosmos/feegrant/v1beta1/allowance/") && uri.endsWith(address))
        .reply(200, createFeeAllowanceResponse({ grantee: address, amount: "5000000" }))
        .get(uri => uri.endsWith(`/cosmos/feegrant/v1beta1/allowances/${address}`))
        .reply(200, { allowances: [createFeeAllowanceResponse({ grantee: address, amount: "5000000" })], pagination: { next_key: null, total: "1" } })
        .get(uri => uri.includes("/cosmos/authz/v1beta1/grants") && uri.includes(address))
        .reply(200, createDeploymentGrantResponseSeed({ grantee: address, amount: "50000000", grantType: "/akash.escrow.v1.DepositAuthorization" }));
      nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
        .persist()
        .post("/v1/tx/funding", body => {
          for (const message of body.data.messages) {
            grantees.push(registry.decode({ typeUrl: message.typeUrl, value: Buffer.from(message.value, "base64") }).grantee);
          }
          return true;
        })
        .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } });

      return grantees;
    }
  });

  function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  async function initiate(headers: Record<string, string>, data: { forfeitAcknowledged: boolean }) {
    return await app.request("/v1/user/me/initiate-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ data })
    });
  }

  async function confirm(token: string) {
    return await app.request("/v1/user/me/confirm-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { token } })
    });
  }

  async function setupSignedInUser(input: { withWallet?: boolean } = {}) {
    const userOverrides = {
      userId: `auth0|${faker.string.alphanumeric(24)}`,
      username: `user-${faker.string.alphanumeric(12)}`,
      email: faker.internet.email()
    };
    const { user, address } = input.withWallet
      ? await seedUserWithWallet({ isTrialing: true, user: userOverrides })
      : { user: await userRepository.create(userOverrides), address: undefined };
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token, address: address! };
  }

  async function setupIssuedLink(input: { expiresAt?: Date } = {}) {
    const user = await userRepository.create({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
    const linkToken = faker.string.alphanumeric(43);
    await tokenRepository.replaceForUser({
      userId: user.id,
      tokenHash: sha256(linkToken),
      acknowledgedForfeitUsd: 0,
      expiresAt: input.expiresAt ?? addMinutes(new Date(), 15)
    });

    return { user, linkToken };
  }

  async function seedApiKey(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      userId,
      hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  function interceptNotifications() {
    const sent: Array<{ payload: { actions: Array<{ url: string }> } }> = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL!)
      .post("/internal/v1/jobs/notification", body => {
        sent.push(body);
        return true;
      })
      .reply(204);

    return sent;
  }

  function answerActiveDeployments(deployments: ReturnType<typeof createDeploymentInfoSeed>[]) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/akash/deployment/v1beta4/deployments/list")
      .query(true)
      .reply(200, { deployments, pagination: { next_key: null, total: String(deployments.length) } });
  }
});
