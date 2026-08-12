import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { AccountBalances, Accounts, BalanceChanges, Delegations, Validators } from "@src/db/schema";

describe("cosmos genesis schema", () => {
  it("interns accounts under a unique address index", () => {
    const config = getTableConfig(Accounts);

    expect(config.name).toBe("accounts");
    expect(config.columns.map(column => column.name)).toContain("is_module_account");
    expect(config.indexes).toHaveLength(1);
  });

  it("keys current balances by account and denom with an account foreign key", () => {
    const config = getTableConfig(AccountBalances);

    expect(config.columns.map(column => column.name).sort()).toEqual(["account_id", "amount", "denom"]);
    expect(config.primaryKeys).toHaveLength(1);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });

  it("references accounts from the ledger for both the holder and the counterparty", () => {
    const config = getTableConfig(BalanceChanges);

    expect(config.foreignKeys).toHaveLength(2);
    expect(config.indexes).toHaveLength(1);
    config.foreignKeys.forEach(foreignKey => expect(foreignKey.reference().foreignColumns[0].name).toBe("id"));
  });

  it("keys delegations by delegator and validator with a delegator foreign key", () => {
    const config = getTableConfig(Delegations);

    expect(config.primaryKeys).toHaveLength(1);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });

  it("keys validators by operator address", () => {
    const config = getTableConfig(Validators);

    expect(config.name).toBe("validators");
    expect(config.columns.map(column => column.name)).toContain("operator_address");
  });
});
