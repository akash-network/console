import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { type FundingOutflowLimit, fundingOutflowLimits, type FundingOutflowLimitScope, fundingOutflows, type FundingOutflowStatus } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";

export type OutflowUsage = { total: bigint; wallet: bigint };
export type WalletOutflow = { walletAddress: string; denom: string; amount: bigint };
export type OutflowLimitKey = { denom: string; scope: FundingOutflowLimitScope; walletAddress?: string };

@singleton()
export class FundingOutflowRepository {
  constructor(@inject(FundingControlsDatabase) private readonly database: FundingControlsDatabase) {}

  async reserve(walletAddress: string, amountsByDenom: ReadonlyMap<string, bigint>): Promise<string[]> {
    const rows = await this.database.orm
      .insert(fundingOutflows)
      .values([...amountsByDenom].map(([denom, amount]) => ({ walletAddress, denom, amount })))
      .returning({ id: fundingOutflows.id });

    return rows.map(row => row.id);
  }

  async settle(ids: readonly string[], status: FundingOutflowStatus, txHash?: string): Promise<void> {
    await this.database.orm
      .update(fundingOutflows)
      .set({ status, txHash, settledAt: sql`now()` })
      .where(inArray(fundingOutflows.id, [...ids]));
  }

  /** Measured on the database's clock, the one that stamped the rows, so a pod whose clock drifts counts the same window as the others. */
  async sumSince(input: { windowHours: number; denoms: readonly string[]; walletAddress: string }): Promise<Map<string, OutflowUsage>> {
    const rows = await this.database.orm
      .select({
        denom: fundingOutflows.denom,
        total: sql<string>`coalesce(sum(${fundingOutflows.amount}), 0)`,
        wallet: sql<string>`coalesce(sum(${fundingOutflows.amount}) filter (where ${fundingOutflows.walletAddress} = ${input.walletAddress}), 0)`
      })
      .from(fundingOutflows)
      .where(and(inArray(fundingOutflows.denom, [...input.denoms]), this.#countsWithin(input.windowHours)))
      .groupBy(fundingOutflows.denom);

    return new Map(rows.map(row => [row.denom, { total: BigInt(row.total), wallet: BigInt(row.wallet) }]));
  }

  async sumByWalletSince(input: { windowHours: number; limit: number }): Promise<WalletOutflow[]> {
    const amount = sql<string>`sum(${fundingOutflows.amount})`;
    const rows = await this.database.orm
      .select({ walletAddress: fundingOutflows.walletAddress, denom: fundingOutflows.denom, amount })
      .from(fundingOutflows)
      .where(this.#countsWithin(input.windowHours))
      .groupBy(fundingOutflows.walletAddress, fundingOutflows.denom)
      .orderBy(desc(amount))
      .limit(input.limit);

    return rows.map(row => ({ ...row, amount: BigInt(row.amount) }));
  }

  async sumByDenomSince(input: { windowHours: number }): Promise<Map<string, bigint>> {
    const rows = await this.database.orm
      .select({ denom: fundingOutflows.denom, amount: sql<string>`sum(${fundingOutflows.amount})` })
      .from(fundingOutflows)
      .where(this.#countsWithin(input.windowHours))
      .groupBy(fundingOutflows.denom);

    return new Map(rows.map(row => [row.denom, BigInt(row.amount)]));
  }

  async findLimits(): Promise<FundingOutflowLimit[]> {
    return await this.database.orm.select().from(fundingOutflowLimits);
  }

  /** Replaces rather than updates, because the two unique indexes a limit can fall under leave no single conflict target to upsert on. */
  async setLimit(input: OutflowLimitKey & { maxAmount: bigint; isEnforced: boolean; setBy: string }): Promise<FundingOutflowLimit> {
    return await this.database.orm.transaction(async tx => {
      await tx.delete(fundingOutflowLimits).where(this.#matches(input));
      const [limit] = await tx.insert(fundingOutflowLimits).values(input).returning();

      return limit;
    });
  }

  async removeLimit(key: OutflowLimitKey): Promise<FundingOutflowLimit[]> {
    return await this.database.orm.delete(fundingOutflowLimits).where(this.#matches(key)).returning();
  }

  #matches({ denom, scope, walletAddress }: OutflowLimitKey) {
    return and(
      eq(fundingOutflowLimits.denom, denom),
      eq(fundingOutflowLimits.scope, scope),
      walletAddress === undefined ? isNull(fundingOutflowLimits.walletAddress) : eq(fundingOutflowLimits.walletAddress, walletAddress)
    );
  }

  #countsWithin(windowHours: number) {
    return and(gt(fundingOutflows.createdAt, sql`now() - make_interval(hours => ${windowHours})`), ne(fundingOutflows.status, "released"));
  }
}
