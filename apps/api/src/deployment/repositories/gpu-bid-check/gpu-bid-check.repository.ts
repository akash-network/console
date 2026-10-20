import { and, countDistinct, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["GpuBidChecks"];
export type GpuBidCheckInput = Partial<Table["$inferInsert"]>;
export type GpuBidCheckInsert = Table["$inferInsert"];
export type GpuBidCheckOutput = Table["$inferSelect"];

export interface CheckedGpuModel {
  vendor: string;
  model: string;
}

export interface PricingBotCheckHistory extends CheckedGpuModel {
  provider: string;
  /** Checks of the model since the cutoff on which screening listed anyone. */
  checks: number;
  /** Of those checks, the ones on which screening listed this provider. */
  screenedChecks: number;
  bidSinceCutoff: boolean;
  lastBidAt: Date | null;
}

@singleton()
export class GpuBidCheckRepository extends BaseRepository<Table, GpuBidCheckInput, GpuBidCheckOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("GpuBidChecks") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "GpuBidCheck", "GpuBidChecks");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new GpuBidCheckRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async insertMany(rows: GpuBidCheckInsert[]): Promise<void> {
    if (!rows.length) return;
    await this.cursor.insert(this.table).values(rows);
  }

  async deleteCheckedBefore(before: Date): Promise<void> {
    await this.cursor.delete(this.table).where(lt(this.table.checkedAt, before));
  }

  async findPricingBotHistory({
    providers,
    models,
    since,
    lastBidSince
  }: {
    providers: string[];
    models: CheckedGpuModel[];
    since: Date;
    lastBidSince: Date;
  }): Promise<PricingBotCheckHistory[]> {
    if (!providers.length || !models.length) return [];

    const isPricingBotCheckOfRequestedModel = and(
      eq(this.table.source, "pricing-bot"),
      or(...models.map(({ vendor, model }) => and(eq(this.table.vendor, vendor), eq(this.table.model, model))))
    );
    const isSinceCutoff = gte(this.table.checkedAt, since);
    const isSinceLastBidCutoff = gte(this.table.checkedAt, lastBidSince);

    const modelChecks = this.cursor
      .select({ vendor: this.table.vendor, model: this.table.model, checks: countDistinct(this.table.dseq).as("checks") })
      .from(this.table)
      .where(and(isPricingBotCheckOfRequestedModel, isSinceCutoff, eq(this.table.screened, true)))
      .groupBy(this.table.vendor, this.table.model)
      .as("model_checks");

    return this.cursor
      .select({
        provider: this.table.provider,
        vendor: this.table.vendor,
        model: this.table.model,
        checks: sql<number>`coalesce(${modelChecks.checks}, 0)`.mapWith(Number),
        screenedChecks: sql<number>`count(distinct ${this.table.dseq}) filter (where ${this.table.screened} and ${isSinceCutoff})`.mapWith(Number),
        bidSinceCutoff: sql<boolean>`coalesce(bool_or(${this.table.bid} and ${isSinceCutoff}), false)`,
        lastBidAt: sql<Date | null>`max(${this.table.checkedAt}) filter (where ${this.table.bid} and ${isSinceLastBidCutoff})`.mapWith(this.table.checkedAt)
      })
      .from(this.table)
      .leftJoin(modelChecks, and(eq(modelChecks.vendor, this.table.vendor), eq(modelChecks.model, this.table.model)))
      .where(and(isPricingBotCheckOfRequestedModel, inArray(this.table.provider, providers)))
      .groupBy(this.table.provider, this.table.vendor, this.table.model, modelChecks.checks);
  }
}
