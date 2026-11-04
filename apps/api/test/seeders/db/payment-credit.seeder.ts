import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { createPaymentCredit } from "../payment-credit.seeder";

type PaymentCreditInsert = ApiPgTables["PaymentCredits"]["$inferInsert"];

export async function seedPaymentCredit(overrides: Partial<PaymentCreditInsert> & Pick<PaymentCreditInsert, "transactionId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [credit] = await db
    .insert(resolveTable("PaymentCredits"))
    .values(createPaymentCredit({ status: "landed", ...overrides }))
    .returning();

  return credit;
}
