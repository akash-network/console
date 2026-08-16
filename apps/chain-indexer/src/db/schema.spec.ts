import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  AccountBalances,
  Accounts,
  AccountTxs,
  BalanceChanges,
  Bids,
  Delegations,
  DeploymentEvents,
  DeploymentGroupResources,
  DeploymentGroups,
  Deployments,
  Leases,
  MessageDeadLetters,
  ProposalDeposits,
  Proposals,
  ProposalVotes,
  UnbondingDelegations,
  Validators
} from "@src/db/schema";

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

    expect(config.columns.map(column => column.name)).toEqual(
      expect.arrayContaining(["jailed", "status", "tokens", "delegator_shares", "unbonding_height", "unbonding_time"])
    );
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

  it("keys message dead letters like messages and keeps the raw bytes with the error", () => {
    const config = getTableConfig(MessageDeadLetters);

    expect(config.name).toBe("message_dead_letters");
    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["height", "tx_index", "index"]);
    expect(config.columns.map(column => column.name).sort()).toEqual(["error", "height", "index", "raw", "tx_index", "type_id"]);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });
});

describe("akash deployment schema", () => {
  it("keys deployments naturally by owner and dseq with denormalized resource totals", () => {
    const config = getTableConfig(Deployments);

    expect(config.name).toBe("deployments");
    const ownerDseq = config.indexes.find(index => index.config.name === "deployments_owner_dseq_idx");
    expect(ownerDseq?.config.unique).toBe(true);
    expect(config.columns.map(column => column.name)).toEqual(
      expect.arrayContaining(["cpu_units", "gpu_units", "memory_bytes", "ephemeral_storage_bytes", "persistent_storage_bytes"])
    );
  });

  it("tracks escrow state and the replay watermark on the deployment row", () => {
    const config = getTableConfig(Deployments);

    expect(config.columns.map(column => column.name)).toEqual(
      expect.arrayContaining(["deposit", "balance", "withdrawn_amount", "block_rate", "last_withdraw_height", "last_processed_height", "close_reason"])
    );
  });

  it("keys groups by deployment and gseq", () => {
    const config = getTableConfig(DeploymentGroups);

    const deploymentGseq = config.indexes.find(index => index.config.name === "deployment_groups_deployment_gseq_idx");
    expect(deploymentGseq?.config.unique).toBe(true);
    expect(config.foreignKeys[0].reference().foreignColumns[0].name).toBe("id");
  });

  it("keys group resources by group and position in the spec", () => {
    const config = getTableConfig(DeploymentGroupResources);

    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["deployment_group_id", "idx"]);
  });

  it("keys bids by the full on-chain bid id and keeps them on close via state", () => {
    const config = getTableConfig(Bids);

    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["deployment_id", "gseq", "oseq", "bseq", "provider_account_id"]);
    expect(config.columns.map(column => column.name)).toContain("state");
  });

  it("keys leases like bids and carries denormalized resource totals", () => {
    const config = getTableConfig(Leases);

    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["deployment_id", "gseq", "oseq", "bseq", "provider_account_id"]);
    expect(config.columns.map(column => column.name)).toEqual(
      expect.arrayContaining(["predicted_closed_height", "withdrawn_amount", "cpu_units", "gpu_units", "memory_bytes"])
    );
  });

  it("keys the timeline by deployment, height and ordinal so re-commits conflict instead of duplicating", () => {
    const config = getTableConfig(DeploymentEvents);

    expect(config.primaryKeys[0].columns.map(column => column.name)).toEqual(["deployment_id", "height", "ordinal"]);
    expect(config.columns.find(column => column.name === "tx_index")?.notNull).toBe(false);
  });
});
