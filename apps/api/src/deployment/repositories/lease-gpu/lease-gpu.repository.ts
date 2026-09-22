import { and, eq, exists, inArray, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { DeploymentSettings } from "@src/deployment/model-schemas";

type Table = ApiPgTables["LeaseGpus"];
export type LeaseGpuInput = Partial<Table["$inferInsert"]>;
export type LeaseGpuInsert = Table["$inferInsert"];
export type LeaseGpuOutput = Table["$inferSelect"];

export type DeploymentLeaseGpuTarget = { userId: string; dseq: string };

@singleton()
export class LeaseGpuRepository extends BaseRepository<Table, LeaseGpuInput, LeaseGpuOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("LeaseGpus") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "LeaseGpu", "LeaseGpus");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new LeaseGpuRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** A re-probe replaces what the last one saw rather than appending, so a card swapped under a rescheduled pod cannot read as a second card. */
  async upsertMany(rows: LeaseGpuInsert[]): Promise<LeaseGpuOutput[]> {
    if (!rows.length) return [];

    return await this.cursor
      .insert(this.table)
      .values(rows)
      .onConflictDoUpdate({
        target: [this.table.userId, this.table.dseq, this.table.gseq, this.table.oseq, this.table.provider, this.table.service],
        set: {
          gpus: sql`excluded.gpus`,
          driverVersion: sql`excluded.driver_version`,
          source: sql`excluded.source`,
          detectedAt: sql`excluded.detected_at`
        }
      })
      .returning();
  }

  async findForDeployments({ userId, dseqs }: { userId: string; dseqs: string[] }): Promise<LeaseGpuOutput[]> {
    if (!dseqs.length) return [];

    return await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.userId, userId), inArray(this.table.dseq, dseqs))));
  }

  async deleteForDeployment({ userId, dseq }: DeploymentLeaseGpuTarget): Promise<void> {
    await this.cursor.delete(this.table).where(and(eq(this.table.userId, userId), eq(this.table.dseq, dseq)));
  }

  /** Backstops the close paths: a deployment whose settings row says closed keeps no hardware reading, whatever dropped the delete at close time. */
  async deleteForClosedDeployments(): Promise<void> {
    await this.cursor.delete(this.table).where(
      exists(
        this.cursor
          .select({ one: sql`1` })
          .from(DeploymentSettings)
          .where(and(eq(DeploymentSettings.userId, this.table.userId), eq(DeploymentSettings.dseq, this.table.dseq), eq(DeploymentSettings.closed, true)))
      )
    );
  }
}
