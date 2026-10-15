import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const STRIPE_API = "https://api.stripe.com";
const STRIPE_FILES = "https://pay.stripe.com";

describe("Card payment invoices", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/stripe/transactions/{id}/invoice", () => {
    it("issues the invoice of a team's card payment for its owner and returns its PDF", async () => {
      const { team, headersOf } = await setup();
      const customerId = `cus_${faker.string.alphanumeric(14)}`;
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id });
      const invoiceId = `in_${faker.string.alphanumeric(14)}`;
      nock(STRIPE_API)
        .get(`/v1/payment_intents/${payment.stripePaymentIntentId}`)
        .reply(200, { id: payment.stripePaymentIntentId, object: "payment_intent", customer: customerId, currency: "usd", created: 1_760_000_000 });
      nock(STRIPE_API)
        .post("/v1/invoices", body => body.customer === customerId && body.effective_at === "1760000000")
        .reply(200, { id: invoiceId, object: "invoice", status: "draft", customer: customerId, lines: { object: "list", data: [], has_more: false } });
      nock(STRIPE_API).post("/v1/invoiceitems").reply(200, { id: "ii_1", object: "invoiceitem" });
      nock(STRIPE_API).post(`/v1/invoices/${invoiceId}/finalize`).reply(200, { id: invoiceId, object: "invoice", status: "open", customer: customerId });
      nock(STRIPE_API)
        .post(`/v1/invoices/${invoiceId}/attach_payment`)
        .reply(200, { id: invoiceId, object: "invoice", status: "paid", customer: customerId, invoice_pdf: `${STRIPE_FILES}/invoice/${invoiceId}/pdf` });
      nock(STRIPE_FILES).get(`/invoice/${invoiceId}/pdf`).reply(200, "%PDF-issued", { "Content-Type": "application/pdf" });

      const response = await requestInvoice(payment.id, headersOf(team.owner));

      await expectPdf(response, "%PDF-issued");
      expect(await findTransaction(payment.id)).toMatchObject({ stripeInvoiceId: invoiceId });
    });

    it("lets an admin download an invoice the team's payment already has", async () => {
      const { team, headersOf, memberWith } = await setup();
      const admin = await memberWith("admin");
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id, stripeInvoiceId: "in_existing" });
      nock(STRIPE_API)
        .get("/v1/invoices/in_existing")
        .reply(200, { id: "in_existing", object: "invoice", status: "paid", invoice_pdf: `${STRIPE_FILES}/invoice/in_existing/pdf` });
      nock(STRIPE_FILES).get("/invoice/in_existing/pdf").reply(200, "%PDF-existing", { "Content-Type": "application/pdf" });

      const response = await requestInvoice(payment.id, headersOf(admin));

      await expectPdf(response, "%PDF-existing");
    });

    it("keeps the invoice of a payment refunded after it was issued downloadable", async () => {
      const { team, headersOf } = await setup();
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id, status: "refunded", stripeInvoiceId: "in_refunded" });
      nock(STRIPE_API)
        .get("/v1/invoices/in_refunded")
        .reply(200, { id: "in_refunded", object: "invoice", status: "paid", invoice_pdf: `${STRIPE_FILES}/invoice/in_refunded/pdf` });
      nock(STRIPE_FILES).get("/invoice/in_refunded/pdf").reply(200, "%PDF-refunded", { "Content-Type": "application/pdf" });

      const response = await requestInvoice(payment.id, headersOf(team.owner));

      await expectPdf(response, "%PDF-refunded");
    });

    it("refuses an admin who asks for an invoice the payment does not have yet, without calling Stripe", async () => {
      const { team, headersOf, memberWith } = await setup();
      const admin = await memberWith("admin");
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id });
      const stripeCalls = nock(STRIPE_API).get(/.*/).reply(200, {});

      const response = await requestInvoice(payment.id, headersOf(admin));

      expect(response.status).toBe(403);
      expect(stripeCalls.isDone()).toBe(false);
      expect(await findTransaction(payment.id)).toMatchObject({ stripeInvoiceId: null });
    });

    it("refuses an admin who would have to finish an invoice that is not paid yet", async () => {
      const { team, headersOf, memberWith } = await setup();
      const admin = await memberWith("admin");
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id, stripeInvoiceId: "in_draft" });
      nock(STRIPE_API).get("/v1/invoices/in_draft").reply(200, { id: "in_draft", object: "invoice", status: "draft", customer: "cus_1" });
      const finalize = nock(STRIPE_API).post("/v1/invoices/in_draft/finalize").reply(200, {});

      const response = await requestInvoice(payment.id, headersOf(admin));

      expect(response.status).toBe(403);
      expect(finalize.isDone()).toBe(false);
    });

    it("answers 400 for a transaction that is not a successful card payment", async () => {
      const { team, headersOf } = await setup();
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id, status: "failed" });

      const response = await requestInvoice(payment.id, headersOf(team.owner));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ message: "Only a successful card payment can have an invoice" });
    });

    it("answers 404 for a payment of another team", async () => {
      const { headersOf, team } = await setup();
      const { organization: otherTeam, user: otherOwner } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
      const payment = await seedCardPayment({ userId: otherOwner.id, organizationId: otherTeam.id });

      const response = await requestInvoice(payment.id, headersOf(team.owner));

      expect(response.status).toBe(404);
    });

    it("answers 404 while invoices are turned off", async () => {
      const { team, headersOf } = await setup({ invoicesEnabled: false });
      const payment = await seedCardPayment({ userId: team.owner.id, organizationId: team.id });

      const response = await requestInvoice(payment.id, headersOf(team.owner));

      expect(response.status).toBe(404);
    });
  });

  async function expectPdf(response: Response, content: string) {
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(await response.text()).toBe(content);
  }

  async function requestInvoice(transactionId: string, headers: Record<string, string>) {
    return await app.request(`/v1/stripe/transactions/${transactionId}/invoice`, { method: "POST", headers });
  }

  async function seedCardPayment(input: { userId: string; organizationId: string; status?: "succeeded" | "failed" | "refunded"; stripeInvoiceId?: string }) {
    const [transaction] = await db
      .insert(resolveTable("StripeTransactions"))
      .values({
        type: "payment_intent",
        status: "succeeded",
        amount: 2500,
        currency: "usd",
        stripePaymentIntentId: `pi_${faker.string.alphanumeric(14)}`,
        ...input
      })
      .returning();

    return transaction;
  }

  async function findTransaction(id: string) {
    return await db.query.StripeTransactions.findFirst({ where: eq(resolveTable("StripeTransactions").id, id) });
  }

  async function setup(input: { invoicesEnabled?: boolean } = {}) {
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
    const tokens = new Map<string, string>();
    const tokenByUserId = new Map<string, string>();

    const authenticate = (user: { id: string; userId: string | null }) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      tokenByUserId.set(user.id, token);
    };
    authenticate(owner);

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async received => tokens.get(received.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag === FeatureFlags.INVOICES) return input.invoicesEnabled ?? true;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return tokenByUserId.has(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });

    const headersOf = (user: { id: string }) => ({ authorization: `Bearer ${tokenByUserId.get(user.id)}`, "x-organization-id": organization.id });
    const memberWith = async (role: OrganizationRole) => {
      const member = await seedUser({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role });
      authenticate(member);

      return member;
    };

    return { team: { ...organization, owner }, headersOf, memberWith };
  }
});
