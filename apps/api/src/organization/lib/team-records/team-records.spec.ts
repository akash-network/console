import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { StripeTransactions } from "@src/billing/model-schemas/stripe-transaction/stripe-transaction.schema";
import { writtenForTeamBy } from "./team-records";

describe(writtenForTeamBy.name, () => {
  it("matches the member's rows filed under a team organization only", () => {
    const query = new PgDialect().sqlToQuery(writtenForTeamBy(StripeTransactions, "user-1"));

    expect(query).toMatchObject({
      sql: '"stripe_transactions"."user_id" = $1 and "stripe_transactions"."organization_id" in (select "organizations"."id" from "organizations" where "organizations"."type" = \'team\')',
      params: ["user-1"]
    });
  });
});
