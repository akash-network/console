import type { CoreConfig } from "@src/core/config/env.config";

export type SinkMigrationMilestoneKey = "announcement" | "voteClosed" | "upgrade";

export type SinkMigrationMilestone = {
  key: SinkMigrationMilestoneKey;
  label: string;
  height: number;
};

/** Ordered by height: wallets are grouped by the last milestone reached before their first unbonding. */
export const SINK_MIGRATION_MILESTONES_BY_NETWORK: Record<CoreConfig["NETWORK"], readonly SinkMigrationMilestone[]> = {
  mainnet: [
    { key: "announcement", label: "Announcement", height: 29238936 },
    { key: "voteClosed", label: "Vote passed", height: 29341402 },
    { key: "upgrade", label: "Upgrade block", height: 29399482 }
  ],
  testnet: [],
  sandbox: []
};
