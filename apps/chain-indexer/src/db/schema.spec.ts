import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { AccountBalances, Accounts, AccountTxs, BalanceChanges, Delegations, ProposalDeposits, Proposals, ProposalVotes, UnbondingDelegations, Validators } from "@src/db/schema";

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
    config.foreignKeys.forEach(foreignKey => expect(foreignKey.reference().foreignColumns[0].name).toBe("id"));
  });

  it("makes the ledger idempotent with a unique (height, event_index) index", () => {
    const config = getTableConfig(BalanceChanges);

    const uniqueOnHeightEvent = config.indexes.find(index => index.config.name === "balance_changes_height_event_index_idx");
    expect(uniqueOnHeightEvent?.config.unique).toBe(true);
    expect(uniqueOnHeightEvent?.config.columns.map(column => (column as { name: string }).name)).toEqual(["height", "event_index"]);
  });

  it("keys the address activity log by account, height, tx and role", () => {
    const config = getTableConfig(AccountTxs);

    expect(config.name).toBe("account_txs");
    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["account_id", "height", "tx_index", "role"]);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
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

  it("enriches validators with snapshot-sourced bond state", () => {
    const config = getTableConfig(Validators);

    expect(config.columns.map(column => column.name)).toEqual(expect.arrayContaining(["jailed", "status", "tokens", "delegator_shares", "unbonding_height", "unbonding_time"]));
  });

  it("keys unbonding delegations by delegator, validator and creation height", () => {
    const config = getTableConfig(UnbondingDelegations);

    expect(config.name).toBe("unbonding_delegations");
    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["delegator_account_id", "validator_operator_address", "creation_height"]);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });

  it("keys proposals by their on-chain id with an optional proposer foreign key", () => {
    const config = getTableConfig(Proposals);

    expect(config.name).toBe("proposals");
    expect(config.columns.find(column => column.name === "id")?.primary).toBe(true);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });

  it("keys proposal votes by proposal and voter", () => {
    const config = getTableConfig(ProposalVotes);

    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["proposal_id", "voter_account_id"]);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });

  it("keys proposal deposits by proposal, depositor and height", () => {
    const config = getTableConfig(ProposalDeposits);

    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["proposal_id", "depositor_account_id", "height"]);
  });
});
