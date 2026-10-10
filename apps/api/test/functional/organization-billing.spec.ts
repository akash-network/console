import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";

const STRIPE_API = "https://api.stripe.com";

describe("Organization billing", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const registry = container.resolve<Registry>(TYPE_REGISTRY);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/stripe/payment-methods/setup", () => {
    it("creates the team's own Stripe customer when its owner adds a first card", async () => {
      const { owner, team, headersOf } = await setup();
      const teamCustomerId = `cus_${faker.string.alphanumeric(14)}`;
      const customerCreate = nock(STRIPE_API)
        .post("/v1/customers", body => body.name === team.name && body["metadata[organizationId]"] === team.id)
        .matchHeader("idempotency-key", `create-organization-customer:${team.id}`)
        .reply(200, { id: teamCustomerId, object: "customer" });
      nock(STRIPE_API)
        .post("/v1/setup_intents", body => body.customer === teamCustomerId)
        .reply(200, { id: "seti_1", object: "setup_intent", client_secret: "seti_secret" });

      const response = await app.request("/v1/stripe/payment-methods/setup", { method: "POST", headers: headersOf(owner) });

      expect(response.status).toBe(200);
      expect(customerCreate.isDone()).toBe(true);
      expect(await findOrganization(team.id)).toMatchObject({ stripeCustomerId: teamCustomerId });
      expect(await findUser(owner.id)).toMatchObject({ stripeCustomerId: null });
    });

    it("keeps setting up the member's own customer while organizations are off for them", async () => {
      const { owner, team, headersOf } = await setup({ organizationsOn: false });
      const userCustomerId = `cus_${faker.string.alphanumeric(14)}`;
      nock(STRIPE_API)
        .post("/v1/customers", body => body["metadata[userId]"] === owner.id)
        .matchHeader("idempotency-key", `create-customer:${owner.id}`)
        .reply(200, { id: userCustomerId, object: "customer" });
      nock(STRIPE_API)
        .post("/v1/setup_intents", body => body.customer === userCustomerId)
        .reply(200, { id: "seti_1", object: "setup_intent", client_secret: "seti_secret" });

      const response = await app.request("/v1/stripe/payment-methods/setup", { method: "POST", headers: headersOf(owner) });

      expect(response.status).toBe(200);
      expect(await findUser(owner.id)).toMatchObject({ stripeCustomerId: userCustomerId });
      expect(await findOrganization(team.id)).toMatchObject({ stripeCustomerId: null });
    });
  });

  describe("POST /v1/stripe/payment-methods/setup by other roles", () => {
    it.each(["admin", "member", "viewer"] satisfies OrganizationRole[])("refuses a %s, who may not add the team's cards", async role => {
      const { headersOf, memberWith } = await setup();
      const member = await memberWith(role);

      const response = await app.request("/v1/stripe/payment-methods/setup", { method: "POST", headers: headersOf(member) });

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /v1/stripe/payment-methods/{paymentMethodId}", () => {
    it("refuses to remove a card attached to another customer than the team's", async () => {
      const { owner, team, headersOf } = await setup();
      await setTeamCustomer(team.id);
      nock(STRIPE_API).get("/v1/payment_methods/pm_elsewhere").reply(200, { id: "pm_elsewhere", object: "payment_method", customer: "cus_elsewhere" });
      const detach = nock(STRIPE_API).post("/v1/payment_methods/pm_elsewhere/detach").reply(200, { id: "pm_elsewhere", object: "payment_method" });

      const response = await app.request("/v1/stripe/payment-methods/pm_elsewhere", { method: "DELETE", headers: headersOf(owner) });

      expect(response.status).toBe(403);
      expect(detach.isDone()).toBe(false);
    });
  });

  describe("GET /v1/stripe/payment-methods", () => {
    it.each(["owner", "billing", "admin"] satisfies OrganizationRole[])("lists the team's payment methods to a %s", async role => {
      const { team, headersOf, memberWith } = await setup();
      const member = await memberWith(role);
      await setTeamCustomer(team.id);
      nock(STRIPE_API)
        .get("/v1/payment_methods")
        .query(true)
        .reply(200, { object: "list", data: [], has_more: false });

      const response = await app.request("/v1/stripe/payment-methods", { headers: headersOf(member) });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    });

    it.each(["member", "viewer"] satisfies OrganizationRole[])("refuses a %s", async role => {
      const { headersOf, memberWith } = await setup();
      const member = await memberWith(role);

      const response = await app.request("/v1/stripe/payment-methods", { headers: headersOf(member) });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /v1/stripe/transactions/confirm", () => {
    it("charges the team's customer and records the charge for the team and the member who paid", async () => {
      const { team, headersOf, memberWith } = await setup();
      const billingMember = await memberWith("billing");
      const teamCustomerId = await setTeamCustomer(team.id);
      const clientKey = faker.string.uuid();
      nock(STRIPE_API).get("/v1/payment_methods/pm_team").reply(200, { id: "pm_team", object: "payment_method", customer: teamCustomerId });
      const charge = nock(STRIPE_API)
        .post("/v1/payment_intents", body => body.customer === teamCustomerId)
        .matchHeader("idempotency-key", `org_topup_${team.id}_${billingMember.id}_${clientKey}`)
        .reply(200, { id: "pi_team", object: "payment_intent", status: "succeeded", amount: 2000, currency: "usd" });

      const response = await confirmPayment(headersOf(billingMember), { userId: billingMember.id, paymentMethodId: "pm_team", amount: 20, idempotencyKey: clientKey });

      expect(response.status).toBe(200);
      expect(charge.isDone()).toBe(true);
      const { data } = (await response.json()) as { data: { transactionId: string } };
      expect(await findTransaction(data.transactionId)).toMatchObject({ organizationId: team.id, userId: billingMember.id, stripePaymentIntentId: "pi_team" });
    });

    it("refuses a member, who may not pay for the team", async () => {
      const { team, headersOf, memberWith } = await setup();
      const member = await memberWith("member");
      await setTeamCustomer(team.id);

      const response = await confirmPayment(headersOf(member), { userId: member.id, paymentMethodId: "pm_team", amount: 20 });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /v1/stripe-webhook", () => {
    it("credits the team's wallet for a settled team charge, not the wallet of the member who paid", async () => {
      const { owner, team } = await setup();
      const teamCustomerId = await setTeamCustomer(team.id);
      const teamWallet = await seedTeamWallet(team.id);
      const ownWallet = await seedOwnWallet(owner.id);
      const transaction = await seedTransaction({ userId: owner.id, organizationId: team.id, status: "pending" });
      const grantees = answerChainFor(teamWallet.address);
      nock(STRIPE_API).get("/v1/charges/ch_team").reply(200, { id: "ch_team", object: "charge", payment_method_details: null });

      const response = await sendWebhook({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_team",
            object: "payment_intent",
            customer: teamCustomerId,
            amount: transaction.amount,
            amount_received: transaction.amount,
            latest_charge: "ch_team",
            payment_method_types: ["card"],
            metadata: { internal_transaction_id: transaction.id }
          }
        }
      });

      expect(response.status).toBe(200);
      expect(await findTransaction(transaction.id)).toMatchObject({ status: "succeeded" });
      expect(new Set(grantees)).toEqual(new Set([teamWallet.address]));
      expect(await findWallet(teamWallet.id)).toMatchObject({ activatedAt: expect.any(Date), isTrialing: false });
      expect(await findWallet(ownWallet.id)).toMatchObject({ activatedAt: null });
    });

    it("debits the team's wallet for a refunded team charge after the member who paid has left the team", async () => {
      const { team, memberWith } = await setup();
      const buyer = await memberWith("billing");
      const teamCustomerId = await setTeamCustomer(team.id);
      const teamWallet = await seedTeamWallet(team.id);
      const transaction = await seedTransaction({ userId: buyer.id, organizationId: team.id, status: "succeeded", stripeChargeId: "ch_refunded" });
      await db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").userId, buyer.id));
      const grantees = answerChainFor(teamWallet.address);

      const response = await sendWebhook({
        type: "charge.refunded",
        data: { object: { id: "ch_refunded", customer: teamCustomerId, amount_refunded: transaction.amount, refunded: true } }
      });

      expect(response.status).toBe(200);
      expect(await findTransaction(transaction.id)).toMatchObject({ status: "refunded", amountRefunded: transaction.amount });
      expect(new Set(grantees)).toEqual(new Set([teamWallet.address]));
    });

    it("still resolves a customer linked to a user, debiting that user's wallet", async () => {
      const user = await seedUser({ stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` });
      const wallet = await seedOwnWallet(user.id);
      const transaction = await seedTransaction({ userId: user.id, organizationId: null, status: "succeeded", stripeChargeId: "ch_legacy" });
      const grantees = answerChainFor(wallet.address);

      const response = await sendWebhook({
        type: "charge.refunded",
        data: { object: { id: "ch_legacy", customer: user.stripeCustomerId, amount_refunded: 1000, refunded: false } }
      });

      expect(response.status).toBe(200);
      expect(await findTransaction(transaction.id)).toMatchObject({ status: "succeeded", amountRefunded: 1000 });
      expect(new Set(grantees)).toEqual(new Set([wallet.address]));
    });
  });

  async function confirmPayment(headers: Record<string, string>, data: { userId: string; paymentMethodId: string; amount: number; idempotencyKey?: string }) {
    return await app.request("/v1/stripe/transactions/confirm", {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: { "Content-Type": "application/json", ...headers }
    });
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

  /** Answers every chain read and funding transaction for one wallet only, and collects the grantee of every grant the funding wallet signs. */
  function answerChainFor(address: string) {
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

  async function setTeamCustomer(organizationId: string) {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    await db.update(resolveTable("Organizations")).set({ stripeCustomerId }).where(eq(resolveTable("Organizations").id, organizationId));

    return stripeCustomerId;
  }

  async function seedTeamWallet(organizationId: string) {
    const [wallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId, address: createAkashAddress(), isTrialing: false })
      .returning();

    return { ...wallet, address: wallet.address! };
  }

  async function seedOwnWallet(userId: string) {
    const [wallet] = await db.insert(resolveTable("UserWallets")).values({ userId, address: createAkashAddress(), isTrialing: true }).returning();

    return { ...wallet, address: wallet.address! };
  }

  async function seedTransaction(input: {
    userId: string;
    organizationId: string | null;
    status: "pending" | "succeeded";
    stripeChargeId?: string;
  }) {
    const [transaction] = await db
      .insert(resolveTable("StripeTransactions"))
      .values({ type: "payment_intent", amount: 2000, currency: "usd", ...input })
      .returning();

    return transaction;
  }

  async function findTransaction(id: string) {
    return await db.query.StripeTransactions.findFirst({ where: eq(resolveTable("StripeTransactions").id, id) });
  }

  async function findWallet(id: number) {
    return await db.query.UserWallets.findFirst({ where: eq(resolveTable("UserWallets").id, id) });
  }

  async function findOrganization(id: string) {
    return await db.query.Organizations.findFirst({ where: eq(resolveTable("Organizations").id, id) });
  }

  async function findUser(id: string) {
    const users = resolveTable("Users");
    const [user] = await db.select().from(users).where(and(eq(users.id, id)));

    return user;
  }

  async function setup(input: { organizationsOn?: boolean } = {}) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
    const tokens = new Map<string, string>();
    const enabledUserIds: string[] = [];

    const authenticate = (user: { id: string; userId: string | null }) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      if (input.organizationsOn !== false) enabledUserIds.push(user.id);
      return token;
    };
    const ownerToken = authenticate(owner);

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async received => tokens.get(received.replace(/^Bearer +/i, "")) ?? null);
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return enabledUserIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });

    const tokenByUserId = new Map<string, string>([[owner.id, ownerToken]]);
    const headersOf = (user: { id: string }) => ({ authorization: `Bearer ${tokenByUserId.get(user.id)}`, "x-organization-id": team.id });
    const memberWith = async (role: OrganizationRole) => {
      const member = await seedUser({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: team.id, userId: member.id, role });
      tokenByUserId.set(member.id, authenticate(member));

      return member;
    };

    return { owner, team, headersOf, memberWith };
  }
});
