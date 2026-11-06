import { gte, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { UnmetDemandSummary } from "@src/deployment/lib/unmet-demand-report/unmet-demand-report";
import type { UnmetDemandKind } from "@src/deployment/model-schemas";

type Table = ApiPgTables["UnmetDemandEvents"];
export type UnmetDemandEventInput = Partial<Table["$inferInsert"]>;
export type UnmetDemandEventInsert = Table["$inferInsert"];
export type UnmetDemandEventOutput = Table["$inferSelect"];

@singleton()
export class UnmetDemandEventRepository extends BaseRepository<Table, UnmetDemandEventInput, UnmetDemandEventOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("UnmetDemandEvents") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "UnmetDemandEvent", "UnmetDemandEvents");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UnmetDemandEventRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Skips an event whose dedupe key is already stored, which is how a repeated ask counts once. */
  async insertMany(events: UnmetDemandEventInsert[]): Promise<void> {
    if (!events.length) return;
    await this.cursor.insert(this.table).values(events).onConflictDoNothing({ target: this.table.dedupeKey });
  }

  async summarizeSince(since: Date): Promise<UnmetDemandSummary[]> {
    const countOf = (kind: UnmetDemandKind) => sql<number>`count(*) filter (where ${this.table.kind} = ${kind})`.mapWith(Number);

    return await this.cursor
      .select({
        vendor: this.table.vendor,
        model: this.table.model,
        regionArea: this.table.regionArea,
        noFit: countOf("no_fit"),
        missingGpu: countOf("missing_gpu"),
        zeroBid: countOf("zero_bid"),
        gpusAsked: sql<number>`sum(${this.table.gpuCount})`.mapWith(Number)
      })
      .from(this.table)
      .where(gte(this.table.occurredAt, since))
      .groupBy(this.table.vendor, this.table.model, this.table.regionArea);
  }
}
