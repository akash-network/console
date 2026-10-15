import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { IssueCardPaymentInvoiceCommand } from "@src/billing/commands/issue-card-payment-invoice.command";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CardPaymentInvoiceHandler } from "./card-payment-invoice.handler";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const STRIPE_API = "https://api.stripe.com";

const jobWorkers = useJobWorkers(() => [container.resolve(CardPaymentInvoiceHandler)]);

describe(CardPaymentInvoiceHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("issues and pays the invoice of a settled card payment, run the way a worker runs it", async () => {
    const { transaction, paymentIntentId, customerId, enqueue, startWorkers, findTransaction } = await setup();
    const invoiceId = `in_${faker.string.alphanumeric(14)}`;
    nock(STRIPE_API)
      .get(`/v1/payment_intents/${paymentIntentId}`)
      .reply(200, { id: paymentIntentId, object: "payment_intent", customer: customerId, currency: "usd", created: 1_760_000_000 });
    nock(STRIPE_API)
      .post(
        "/v1/invoices",
        body => body.customer === customerId && body.auto_advance === "false" && body["metadata[internal_transaction_id]"] === transaction.id
      )
      .reply(200, { id: invoiceId, object: "invoice", status: "draft", customer: customerId, lines: { object: "list", data: [], has_more: false } });
    const lineAdded = nock(STRIPE_API)
      .post("/v1/invoiceitems", body => body.invoice === invoiceId && body.amount === String(transaction.amount))
      .reply(200, { id: "ii_1", object: "invoiceitem" });
    nock(STRIPE_API).post(`/v1/invoices/${invoiceId}/finalize`).reply(200, { id: invoiceId, object: "invoice", status: "open", customer: customerId });
    const paid = nock(STRIPE_API)
      .post(`/v1/invoices/${invoiceId}/attach_payment`, body => body.payment_intent === paymentIntentId)
      .reply(200, { id: invoiceId, object: "invoice", status: "paid", customer: customerId });

    await enqueue(new IssueCardPaymentInvoiceCommand({ transactionId: transaction.id }));
    await startWorkers();

    await expectJobCompleted(IssueCardPaymentInvoiceCommand[JOB_NAME], { data: { transactionId: transaction.id } });
    expect(await findTransaction(transaction.id)).toMatchObject({ stripeInvoiceId: invoiceId });
    expect(lineAdded.isDone()).toBe(true);
    expect(paid.isDone()).toBe(true);
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("StripeTransactions");
    const { enqueue, startWorkers } = await jobWorkers();
    const user = await seedUser({ userId: faker.string.uuid() });
    const paymentIntentId = `pi_${faker.string.alphanumeric(14)}`;
    const customerId = `cus_${faker.string.alphanumeric(14)}`;
    const [transaction] = await db
      .insert(table)
      .values({ userId: user.id, type: "payment_intent", status: "succeeded", amount: 2500, currency: "usd", stripePaymentIntentId: paymentIntentId })
      .returning();

    const findTransaction = async (id: string) => await db.query.StripeTransactions.findFirst({ where: eq(table.id, id) });

    return { transaction, paymentIntentId, customerId, enqueue, startWorkers, findTransaction };
  }
});
