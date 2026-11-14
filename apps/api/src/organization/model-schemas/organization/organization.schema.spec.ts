import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { ApiKeys } from "@src/auth/model-schemas/api-key/api-key.schema";
import { PaymentMethods } from "@src/billing/model-schemas/payment-method/payment-method.schema";
import { StripeTransactions } from "@src/billing/model-schemas/stripe-transaction/stripe-transaction.schema";
import { WalletSetting } from "@src/billing/model-schemas/wallet-setting/wallet-setting.schema";
import { DeploymentSettings } from "@src/deployment/model-schemas/deployment-setting/deployment-setting.schema";
import { Templates } from "@src/user/model-schemas/template/template.schema";

describe("tables owned by an organization", () => {
  it.each([
    ["api_keys", ApiKeys],
    ["payment_methods", PaymentMethods],
    ["stripe_transactions", StripeTransactions],
    ["wallet_settings", WalletSetting],
    ["deployment_settings", DeploymentSettings],
    ["template", Templates]
  ] as const)("%s refuses a row without an existing organization", (tableName, table: PgTable) => {
    const { name, columns, foreignKeys } = getTableConfig(table);

    expect(name).toBe(tableName);
    expect(columns.find(column => column.name === "organization_id")?.notNull).toBe(true);
    expect(
      foreignKeys.map(foreignKey => {
        const { columns: referencing, foreignColumns, foreignTable } = foreignKey.reference();
        return {
          columns: referencing.map(column => column.name),
          foreignTable: getTableConfig(foreignTable).name,
          foreignColumns: foreignColumns.map(column => column.name)
        };
      })
    ).toContainEqual({ columns: ["organization_id"], foreignTable: "organizations", foreignColumns: ["id"] });
  });
});
