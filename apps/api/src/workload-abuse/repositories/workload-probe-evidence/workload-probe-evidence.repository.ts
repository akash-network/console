import { and, asc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { ProbeEvidenceBehaviouralFinding } from "@src/workload-abuse/model-schemas";

type Table = ApiPgTables["WorkloadProbeEvidence"];
export type WorkloadProbeEvidenceInput = Partial<Table["$inferInsert"]>;
export type WorkloadProbeEvidenceInsert = Table["$inferInsert"];
export type WorkloadProbeEvidenceOutput = Table["$inferSelect"];

@singleton()
export class WorkloadProbeEvidenceRepository extends BaseRepository<Table, WorkloadProbeEvidenceInput, WorkloadProbeEvidenceOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("WorkloadProbeEvidence") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "WorkloadProbeEvidence", "WorkloadProbeEvidence");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new WorkloadProbeEvidenceRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async insertMany(rows: WorkloadProbeEvidenceInsert[]): Promise<WorkloadProbeEvidenceOutput[]> {
    if (!rows.length) return [];
    return await this.cursor.insert(this.table).values(rows).returning();
  }

  async recordBehaviouralFindings({ id, findings }: { id: string; findings: ProbeEvidenceBehaviouralFinding[] }): Promise<void> {
    await this.cursor.update(this.table).set({ behaviouralFindings: findings }).where(eq(this.table.id, id));
  }

  async findCreatedBetween({ since, until }: { since: Date; until: Date }): Promise<WorkloadProbeEvidenceOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(and(gte(this.table.createdAt, since), lte(this.table.createdAt, until)))
      .orderBy(asc(this.table.createdAt));
  }

  async findRecentForDeployment({ walletId, dseq, since }: { walletId: number; dseq: string; since: Date }): Promise<WorkloadProbeEvidenceOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.walletId, walletId), eq(this.table.dseq, dseq), gt(this.table.createdAt, since)))
      .orderBy(asc(this.table.createdAt));
  }

  async countDistinctDeploymentsSince({ since }: { since: Date }): Promise<number> {
    const [row] = await this.cursor
      .select({ deployments: sql<number>`count(distinct (${this.table.walletId}, ${this.table.dseq}))` })
      .from(this.table)
      .where(gt(this.table.createdAt, since));
    return Number(row?.deployments ?? 0);
  }

  async deleteOlderThan({ before }: { before: Date }): Promise<void> {
    await this.cursor.delete(this.table).where(lt(this.table.createdAt, before));
  }
}
