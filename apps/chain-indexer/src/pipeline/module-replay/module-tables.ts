import type { PgTable } from "drizzle-orm/pg-core";

import {
  AccountBalances,
  AccountTxs,
  ActMigrationQueue,
  ActMigrationState,
  BalanceChanges,
  Bids,
  BmeCanceledRecords,
  BmeLedgerRecords,
  BmeStatusChanges,
  DeploymentEvents,
  DeploymentGroupResources,
  DeploymentGroups,
  Deployments,
  Leases,
  NetworkRollups,
  NetworkState,
  ProposalDeposits,
  Proposals,
  ProposalVotes,
  ProviderAuditSignatures,
  Providers
} from "@src/db/schema";
import { GENESIS_STREAM } from "@src/genesis/genesis-import.service";
import type { ReplayableModule } from "@src/pipeline/modules";

/** Everything a module replay owns: its tables, and the `indexer_state` streams (LIKE patterns) that hold its progress markers. */
export interface ModuleOwnership {
  tables: PgTable[];
  statePatterns: string[];
}

/**
 * The akash module carries the network aggregates and the ACT migration with it because they are folded
 * from the same reducer pass. The balance module owns the genesis seed rows, so its reset drops the genesis
 * marker and the replay re-seeds before block 1. `accounts` is shared by every module and never reset.
 */
export const MODULE_OWNERSHIP: Record<ReplayableModule, ModuleOwnership> = {
  balance: { tables: [BalanceChanges, AccountBalances, AccountTxs], statePatterns: [GENESIS_STREAM] },
  gov: { tables: [Proposals, ProposalVotes, ProposalDeposits], statePatterns: [] },
  akash: {
    tables: [
      DeploymentEvents,
      Leases,
      Bids,
      DeploymentGroupResources,
      DeploymentGroups,
      ActMigrationQueue,
      Deployments,
      NetworkState,
      NetworkRollups,
      ActMigrationState
    ],
    statePatterns: ["act-migration:%"]
  },
  provider: { tables: [Providers, ProviderAuditSignatures], statePatterns: [] },
  bme: { tables: [BmeLedgerRecords, BmeStatusChanges, BmeCanceledRecords], statePatterns: [] }
};
