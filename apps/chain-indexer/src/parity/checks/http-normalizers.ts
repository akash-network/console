import { z } from "zod";

import { ListAddressTransactionsResponseSchema } from "@src/http-schemas/address-transactions.schema";
import { GetBlockResponseSchema, ListBlocksResponseSchema } from "@src/http-schemas/blocks.schema";
import { GetNetworkStatsResponseSchema } from "@src/http-schemas/network-stats.schema";

export interface NormalizedBlockSummary {
  height: number;
  datetime: string;
  transactionCount: number;
}

export interface NormalizedTransaction {
  height?: number;
  hash: string;
  isSuccess: boolean;
  messageTypes: string[];
}

export interface NormalizedBlock {
  height: number;
  datetime: string;
  hash: string;
  gasUsed: number;
  gasWanted: number;
  transactions: NormalizedTransaction[];
}

export interface NormalizedAddressTransactions {
  total: number;
  transactions: NormalizedTransaction[];
}

export interface NormalizedNetworkStats {
  height: number;
  activeLeaseCount: number;
  totalLeaseCount: number;
  activeCpu: number;
  activeGpu: number;
  activeMemory: number;
  activeStorage: number;
  totalUaktSpent: number;
  totalUusdcSpent: number;
  totalUactSpent: number;
}

const LegacyMessageSchema = z.object({ type: z.string() });

const LegacyTransactionSchema = z.object({ hash: z.string(), isSuccess: z.boolean(), messages: z.array(LegacyMessageSchema) });

const LegacyBlockSummarySchema = z.object({ height: z.number(), datetime: z.string(), transactionCount: z.number() });

const LegacyBlockSchema = z.object({
  height: z.number(),
  datetime: z.string(),
  hash: z.string(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  transactions: z.array(LegacyTransactionSchema)
});

const LegacyAddressTransactionsSchema = z.object({
  count: z.number(),
  results: z.array(LegacyTransactionSchema.extend({ height: z.number() }))
});

export const LegacyDashboardSchema = z.object({
  now: z.object({
    height: z.number(),
    activeLeaseCount: z.number(),
    totalLeaseCount: z.number(),
    activeCPU: z.number(),
    activeGPU: z.number(),
    activeMemory: z.number(),
    activeStorage: z.number(),
    totalUAktSpent: z.number(),
    totalUUsdcSpent: z.number(),
    totalUActSpent: z.number()
  })
});

export function normalizeLegacyBlockSummaries(body: unknown): Map<number, NormalizedBlockSummary> {
  return byHeight(z.array(LegacyBlockSummarySchema).parse(body));
}

export function normalizeV2BlockSummaries(body: unknown): Map<number, NormalizedBlockSummary> {
  return byHeight(ListBlocksResponseSchema.shape.data.parse(body));
}

export function normalizeLegacyBlock(body: unknown): NormalizedBlock {
  const block = LegacyBlockSchema.parse(body);
  return {
    height: block.height,
    datetime: block.datetime,
    hash: block.hash,
    gasUsed: block.gasUsed,
    gasWanted: block.gasWanted,
    transactions: block.transactions.map(tx => ({ hash: tx.hash, isSuccess: tx.isSuccess, messageTypes: tx.messages.map(message => message.type) }))
  };
}

export function normalizeV2Block(body: unknown): NormalizedBlock {
  const block = GetBlockResponseSchema.shape.data.parse(body);
  return {
    height: block.height,
    datetime: block.datetime,
    hash: block.hash,
    gasUsed: block.transactions.reduce((sum, tx) => sum + tx.gasUsed, 0),
    gasWanted: block.transactions.reduce((sum, tx) => sum + tx.gasWanted, 0),
    transactions: block.transactions.map(tx => ({ hash: tx.hash, isSuccess: tx.code === 0, messageTypes: tx.messages.map(message => message.type) }))
  };
}

export function normalizeLegacyAddressTransactions(body: unknown): NormalizedAddressTransactions {
  const page = LegacyAddressTransactionsSchema.parse(body);
  return {
    total: page.count,
    transactions: page.results.map(tx => ({
      height: tx.height,
      hash: tx.hash,
      isSuccess: tx.isSuccess,
      messageTypes: tx.messages.map(message => message.type)
    }))
  };
}

export function normalizeV2AddressTransactions(body: unknown): NormalizedAddressTransactions {
  const page = ListAddressTransactionsResponseSchema.shape.data.parse(body);
  return {
    total: page.total,
    transactions: page.transactions.map(tx => ({
      height: tx.height,
      hash: tx.hash,
      isSuccess: tx.code === 0,
      messageTypes: tx.messages.map(message => message.type)
    }))
  };
}

export function normalizeLegacyNetworkStats(body: unknown): NormalizedNetworkStats {
  const now = LegacyDashboardSchema.shape.now.parse(body);
  return {
    height: now.height,
    activeLeaseCount: now.activeLeaseCount,
    totalLeaseCount: now.totalLeaseCount,
    activeCpu: now.activeCPU,
    activeGpu: now.activeGPU,
    activeMemory: now.activeMemory,
    activeStorage: now.activeStorage,
    totalUaktSpent: wholeUnits(now.totalUAktSpent),
    totalUusdcSpent: wholeUnits(now.totalUUsdcSpent),
    totalUactSpent: wholeUnits(now.totalUActSpent)
  };
}

export function normalizeV2NetworkStats(body: unknown): NormalizedNetworkStats {
  const stats = GetNetworkStatsResponseSchema.shape.data.parse(body);
  return {
    height: stats.height,
    activeLeaseCount: stats.activeLeaseCount,
    totalLeaseCount: stats.totalLeaseCount,
    activeCpu: stats.active.cpuUnits,
    activeGpu: stats.active.gpuUnits,
    activeMemory: stats.active.memoryBytes,
    activeStorage: stats.active.ephemeralStorageBytes + stats.active.persistentStorageBytes,
    totalUaktSpent: wholeUnits(stats.totalSpent.uakt),
    totalUusdcSpent: wholeUnits(stats.totalSpent.uusdc),
    totalUactSpent: wholeUnits(stats.totalSpent.uact)
  };
}

function byHeight(summaries: NormalizedBlockSummary[]): Map<number, NormalizedBlockSummary> {
  return new Map(
    summaries.map(summary => [summary.height, { height: summary.height, datetime: summary.datetime, transactionCount: summary.transactionCount }])
  );
}

/** The legacy API accumulates spend in floating point and v2 keeps 18 decimals, so only the whole u-denom units are comparable. */
function wholeUnits(amount: number | string): number {
  return Math.floor(Number(amount));
}
