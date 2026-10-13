import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
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
import type { UserOutput } from "@src/user/repositories";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";

const STRIPE_API = "https://api.stripe.com";
const QUALIFYING_AMOUNT_USD = 100;
const BONUS_CENTS = 10_00;

describe("First-purchase bonus", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const registry = container.resolve<Registry>(TYPE_REGISTRY);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/stripe-webhook", () => {
    it("grants a person's first purchase in a team the bonus, then none for that person's first purchase in another team", async () => {
      const { person, buyInTeam, teamOwnedBy } = await setup();
      const firstTeam = await teamOwnedBy(person);
      const secondTeam = await teamOwnedBy(person);

      const firstPurchase = await buyInTeam(person, firstTeam);
      const secondPurchase = await buyInTeam(person, secondTeam);

      expect(firstPurchase).toMatchObject({ status: "succeeded", bonusAmount: BONUS_CENTS, organizationId: firstTeam.id, userId: person.id });
      expect(secondPurchase).toMatchObject({ status: "succeeded", bonusAmount: 0, organizationId: secondTeam.id, userId: person.id });
    });

    it("grants the bonus to a team's first purchase only, whoever makes the next one", async () => {
      const { person, buyInTeam, teamOwnedBy, memberOf } = await setup();
      const team = await teamOwnedBy(person);
      const billingMember = await memberOf(team, "billing");

      await buyInTeam(person, team);
      const memberPurchase = await buyInTeam(billingMember, team);

      expect(memberPurchase).toMatchObject({ status: "succeeded", bonusAmount: 0, userId: billingMember.id });
    });

    it("keeps a person ineligible after the purchase that earned the bonus is refunded", async () => {
      const { person, buyInTeam, teamOwnedBy, refund, eligibilityIn } = await setup();
      const firstTeam = await teamOwnedBy(person);
      const secondTeam = await teamOwnedBy(person);
      const bonused = await buyInTeam(person, firstTeam);

      await refund(bonused!, firstTeam);
      const eligibility = await eligibilityIn(person, secondTeam);
      const nextPurchase = await buyInTeam(person, secondTeam);

      expect(await findTransaction(bonused!.id)).toMatchObject({ status: "refunded", bonusAmount: BONUS_CENTS });
      expect(eligibility).toEqual({ data: { eligible: false } });
      expect(nextPurchase).toMatchObject({ status: "succeeded", bonusAmount: 0 });
    });

    it("grants a single-account user's first purchase the bonus once while organizations are off", async () => {
      const { person, buyAsUser, eligibilityIn } = await setup({ organizationsOn: false });

      const before = await eligibilityIn(person);
      const firstPurchase = await buyAsUser(person);
      const after = await eligibilityIn(person);
      const secondPurchase = await buyAsUser(person);

      expect(before).toEqual({ data: { eligible: true } });
      expect(firstPurchase).toMatchObject({ status: "succeeded", bonusAmount: BONUS_CENTS });
      expect(after).toEqual({ data: { eligible: false } });
      expect(secondPurchase).toMatchObject({ status: "succeeded", bonusAmount: 0 });
    });
  });

  describe("GET /v1/stripe/first-purchase-bonus", () => {
    it("answers eligible for a person who never received the bonus in a team that never paid", async () => {
      const { person, teamOwnedBy, eligibilityIn } = await setup();
      const team = await teamOwnedBy(person);

      expect(await eligibilityIn(person, team)).toEqual({ data: { eligible: true } });
    });

    it("answers not eligible in a new team for a person who received the bonus in another team", async () => {
      const { person, buyInTeam, teamOwnedBy, eligibilityIn } = await setup();
      const firstTeam = await teamOwnedBy(person);
      const secondTeam = await teamOwnedBy(person);
      await buyInTeam(person, firstTeam);

      expect(await eligibilityIn(person, secondTeam)).toEqual({ data: { eligible: false } });
    });

    it.each(["admin", "billing"] satisfies OrganizationRole[])("answers a team %s, who may read the team's payments", async role => {
      const { person, teamOwnedBy, memberOf, eligibilityIn } = await setup();
      const team = await teamOwnedBy(person);
      const reader = await memberOf(team, role);

      expect(await eligibilityIn(reader, team)).toEqual({ data: { eligible: true } });
    });

    it.each(["member", "viewer"] satisfies OrganizationRole[])("refuses a team %s, who may not read the team's payments", async role => {
      const { person, teamOwnedBy, memberOf, request } = await setup();
      const team = await teamOwnedBy(person);
      const member = await memberOf(team, role);

      const response = await request(member, "/v1/stripe/first-purchase-bonus", { organizationId: team.id });

      expect(response.status).toBe(403);
    });

    it("answers an API key caller for the team the key is bound to and the key's owner", async () => {
      const { person, buyInTeam, teamOwnedBy } = await setup();
      const firstTeam = await teamOwnedBy(person);
      const secondTeam = await teamOwnedBy(person);
      await buyInTeam(person, firstTeam);
      const apiKey = await seedApiKey({ userId: person.id, organizationId: secondTeam.id });

      const response = await app.request("/v1/stripe/first-purchase-bonus", { headers: { "x-api-key": apiKey } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { eligible: false } });
    });
  });

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

  async function findTransaction(id: string) {
    return await db.query.StripeTransactions.findFirst({ where: eq(resolveTable("StripeTransactions").id, id) });
  }

  async function setup(input: { organizationsOn?: boolean } = {}) {
    const tokens = new Map<string, string>();
    const tokenByUserId = new Map<string, string>();
    const enabledUserIds: string[] = [];
    const customerByOwnerId = new Map<string, string>();

    vi.spyOn(container.resolve(DomainEventsService), "publish").mockResolvedValue(null);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async received => tokens.get(received.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return enabledUserIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });

    const signUp = async () => {
      const user = await seedUser({ userId: faker.string.uuid(), stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` });
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      tokenByUserId.set(user.id, token);
      if (input.organizationsOn !== false) enabledUserIds.push(user.id);
      customerByOwnerId.set(user.id, user.stripeCustomerId!);

      return user;
    };

    const person = await signUp();

    const request = async (user: UserOutput, path: string, options: { organizationId?: string; body?: unknown } = {}) =>
      await app.request(path, {
        method: options.body ? "POST" : "GET",
        body: options.body ? JSON.stringify({ data: options.body }) : undefined,
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${tokenByUserId.get(user.id)}`,
          ...(options.organizationId ? { "x-organization-id": options.organizationId } : {})
        }
      });

    const teamOwnedBy = async (owner: UserOutput) => {
      const { organization } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
      await seedOrganizationMember({ organizationId: organization.id, userId: owner.id, role: "owner" });
      const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
      await db
        .update(resolveTable("Organizations"))
        .set({ stripeCustomerId })
        .where(eq(resolveTable("Organizations").id, organization.id));
      await db
        .insert(resolveTable("UserWallets"))
        .values({ userId: null, organizationId: organization.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() });
      customerByOwnerId.set(organization.id, stripeCustomerId);

      return organization;
    };

    const memberOf = async (team: { id: string }, role: OrganizationRole) => {
      const member = await signUp();
      await seedOrganizationMember({ organizationId: team.id, userId: member.id, role });

      return member;
    };

    const answerChain = () => {
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .persist()
        .get(uri => uri.includes("/cosmos/feegrant/v1beta1/allowance/"))
        .reply(200, (uri: string) => createFeeAllowanceResponse({ grantee: uri.split("/").pop()!, amount: "5000000" }))
        .get(uri => uri.includes("/cosmos/feegrant/v1beta1/allowances/"))
        .reply(200, (uri: string) => ({
          allowances: [createFeeAllowanceResponse({ grantee: uri.split("/").pop()!, amount: "5000000" })],
          pagination: { next_key: null, total: "1" }
        }))
        .get(uri => uri.includes("/cosmos/authz/v1beta1/grants"))
        .reply(200, (uri: string) =>
          createDeploymentGrantResponseSeed({
            grantee: new URL(uri, "http://chain").searchParams.get("grantee") ?? "",
            amount: "50000000",
            grantType: "/akash.escrow.v1.DepositAuthorization"
          })
        );
      nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
        .persist()
        .post("/v1/tx/funding", body =>
          body.data.messages.every(
            (message: { typeUrl: string; value: string }) => !!registry.decode({ typeUrl: message.typeUrl, value: Buffer.from(message.value, "base64") })
          )
        )
        .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } });
    };

    const sendWebhook = async (event: Record<string, unknown>) => {
      const payload = JSON.stringify({ id: `evt_${faker.string.alphanumeric(14)}`, ...event });

      return await app.request("/v1/stripe-webhook", {
        method: "POST",
        body: payload,
        headers: {
          "Content-Type": "text/plain",
          "Stripe-Signature": stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! })
        }
      });
    };

    const buy = async (buyer: UserOutput, payer: { customerId: string; organizationId?: string }) => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(14)}`;
      const paymentIntentId = `pi_${faker.string.alphanumeric(14)}`;
      const chargeId = `ch_${faker.string.alphanumeric(14)}`;
      const amountCents = QUALIFYING_AMOUNT_USD * 100;
      nock(STRIPE_API).get(`/v1/payment_methods/${paymentMethodId}`).reply(200, { id: paymentMethodId, object: "payment_method", customer: payer.customerId });
      nock(STRIPE_API)
        .post("/v1/payment_intents", body => body.customer === payer.customerId)
        .reply(200, { id: paymentIntentId, object: "payment_intent", status: "succeeded", amount: amountCents, currency: "usd" });
      nock(STRIPE_API).get(`/v1/charges/${chargeId}`).reply(200, { id: chargeId, object: "charge", payment_method_details: null });
      answerChain();

      const confirmed = await request(buyer, "/v1/stripe/transactions/confirm", {
        organizationId: payer.organizationId,
        body: { userId: buyer.id, paymentMethodId, amount: QUALIFYING_AMOUNT_USD, idempotencyKey: faker.string.uuid() }
      });
      expect(confirmed.status).toBe(200);
      const { data } = (await confirmed.json()) as { data: { transactionId: string } };

      const settled = await sendWebhook({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: paymentIntentId,
            object: "payment_intent",
            customer: payer.customerId,
            amount: amountCents,
            amount_received: amountCents,
            latest_charge: chargeId,
            payment_method_types: ["card"],
            metadata: { internal_transaction_id: data.transactionId }
          }
        }
      });
      expect(settled.status).toBe(200);

      return await findTransaction(data.transactionId);
    };

    const buyInTeam = async (buyer: UserOutput, team: { id: string }) =>
      await buy(buyer, { customerId: customerByOwnerId.get(team.id)!, organizationId: team.id });

    const buyAsUser = async (buyer: UserOutput) => {
      await db
        .insert(resolveTable("UserWallets"))
        .values({ userId: buyer.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
        .onConflictDoNothing();

      return await buy(buyer, { customerId: customerByOwnerId.get(buyer.id)! });
    };

    const refund = async (transaction: { stripeChargeId: string | null; amount: number }, team: { id: string }) => {
      answerChain();
      const response = await sendWebhook({
        type: "charge.refunded",
        data: { object: { id: transaction.stripeChargeId, customer: customerByOwnerId.get(team.id), amount_refunded: transaction.amount, refunded: true } }
      });
      expect(response.status).toBe(200);
    };

    const eligibilityIn = async (user: UserOutput, team?: { id: string }) => {
      const response = await request(user, "/v1/stripe/first-purchase-bonus", { organizationId: team?.id });
      expect(response.status).toBe(200);

      return await response.json();
    };

    return { person, request, teamOwnedBy, memberOf, buyInTeam, buyAsUser, refund, eligibilityIn };
  }
});
