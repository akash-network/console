import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const FUNDING_OUTFLOW_STATUSES = ["reserved", "landed", "released"] as const;
export type FundingOutflowStatus = (typeof FUNDING_OUTFLOW_STATUSES)[number];

export const fundingOutflows = pgTable(
  "funding_outflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    denom: text("denom").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    /** `reserved` counts like `landed`, so a deposit whose transaction was never settled still weighs on the limits. */
    status: text("status", { enum: FUNDING_OUTFLOW_STATUSES }).notNull().default("reserved"),
    txHash: text("tx_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true })
  },
  table => ({
    denomCreatedAtIdx: index("idx_funding_outflows_denom_created_at").on(table.denom, table.createdAt),
    walletDenomCreatedAtIdx: index("idx_funding_outflows_wallet_denom_created_at").on(table.walletAddress, table.denom, table.createdAt)
  })
);

export type FundingOutflow = typeof fundingOutflows.$inferSelect;

export const FUNDING_OUTFLOW_LIMIT_SCOPES = ["total", "wallet"] as const;
export type FundingOutflowLimitScope = (typeof FUNDING_OUTFLOW_LIMIT_SCOPES)[number];

export const fundingOutflowLimits = pgTable(
  "funding_outflow_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    denom: text("denom").notNull(),
    /** `total` bounds every wallet together; `wallet` bounds each wallet, or the one wallet named beside it. */
    scope: text("scope", { enum: FUNDING_OUTFLOW_LIMIT_SCOPES }).notNull(),
    walletAddress: text("wallet_address"),
    maxAmount: bigint("max_amount", { mode: "bigint" }).notNull(),
    isEnforced: boolean("is_enforced").notNull().default(false),
    setBy: text("set_by").notNull(),
    setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    oneSharedLimitPerScope: uniqueIndex("uniq_funding_outflow_limits_shared")
      .on(table.denom, table.scope)
      .where(sql`wallet_address IS NULL`),
    oneLimitPerNamedWallet: uniqueIndex("uniq_funding_outflow_limits_named_wallet")
      .on(table.denom, table.walletAddress)
      .where(sql`wallet_address IS NOT NULL`),
    onlyWalletScopeNamesAWallet: check("chk_funding_outflow_limits_named_wallet_scope", sql`scope = 'wallet' OR wallet_address IS NULL`),
    positiveMaxAmount: check("chk_funding_outflow_limits_positive_max", sql`max_amount > 0`)
  })
);

export type FundingOutflowLimit = typeof fundingOutflowLimits.$inferSelect;
