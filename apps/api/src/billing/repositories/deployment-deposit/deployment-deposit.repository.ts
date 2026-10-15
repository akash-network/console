import { and, asc, eq, gte, inArray, isNotNull, lt, min, ne, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import type { DeploymentDepositStatus } from "@src/billing/model-schemas/deployment-deposit/deployment-deposit.schema";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["DeploymentDeposits"];
export type DeploymentDepositInput = Table["$inferInsert"];
export type DeploymentDepositOutput = Table["$inferSelect"];

export type CommittedSpend = { projectId: string | null; amountCents: number };

export type SpendWindow = { from: Date; to: Date };

type SettledStatus = Exclude<DeploymentDepositStatus, "pending">;

const DEPLOYMENT_CLAIM_LOCK_NAMESPACE = 77_210_021;

@singleton()
export class DeploymentDepositRepository extends OrgScopedRepository<Table, DeploymentDepositInput, DeploymentDepositOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("DeploymentDeposits") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "DeploymentDeposit", "DeploymentDeposits");
  }

  protected newInstance() {
    return new DeploymentDepositRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async createMany(inputs: DeploymentDepositInput[]): Promise<DeploymentDepositOutput[]> {
    if (!inputs.length) return [];

    const values = await Promise.all(inputs.map(input => this.attributeToOrganization(input)));
    const rows = await this.cursor.insert(this.table).values(values).returning();

    return this.toOutputList(rows);
  }

  /** Only a pending row moves, so a late answer never overturns an outcome already recorded. */
  async settlePending(ids: string[], { status, txHash }: { status: SettledStatus; txHash?: string }): Promise<void> {
    if (!ids.length) return;

    await this.updateWhere(this.whereInOrganization(and(inArray(this.table.id, ids), eq(this.table.status, "pending"))), {
      status,
      ...(txHash && { txHash })
    });
  }

  async attachTxHash(ids: string[], txHash: string): Promise<void> {
    if (!ids.length) return;

    await this.updateWhere(this.whereInOrganization(inArray(this.table.id, ids)), { txHash });
  }

  async settlePendingByTxHash(txHash: string, status: SettledStatus): Promise<number> {
    const rows = await this.updateWhere(
      this.whereInOrganization(and(eq(this.table.txHash, txHash), eq(this.table.status, "pending"))),
      { status },
      { returning: true }
    );

    return rows.length;
  }

  async findPendingByIds(ids: string[]): Promise<DeploymentDepositOutput[]> {
    if (!ids.length) return [];

    const rows = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereInOrganization(and(inArray(this.table.id, ids), eq(this.table.status, "pending"))));

    return this.toOutputList(rows);
  }

  /** The deployments an organization's wallet is still signing deposits into, which the chain may not show yet. */
  async findPendingDseqsOf(organizationId: string): Promise<string[]> {
    const rows = await this.cursor
      .selectDistinct({ dseq: this.table.dseq })
      .from(this.table)
      .where(this.whereInOrganization(and(eq(this.table.organizationId, organizationId), eq(this.table.status, "pending"))))
      .orderBy(asc(this.table.dseq));

    return rows.map(({ dseq }) => dseq);
  }

  /** Held until the transaction ends, so two checks of the same deployment claim its chain deposits one after the other. */
  async lockDeployment({ owner, dseq }: Pick<DeploymentDepositOutput, "owner" | "dseq">): Promise<void> {
    await this.cursor.execute(sql`select pg_advisory_xact_lock(${DEPLOYMENT_CLAIM_LOCK_NAMESPACE}, hashtext(${owner} || '/' || ${dseq}))`);
  }

  /** A deployment is created once on chain, so a create another row already holds cannot back this one. */
  async hasClaimedCreate({ id, owner, dseq }: Pick<DeploymentDepositOutput, "id" | "owner" | "dseq">): Promise<boolean> {
    const [row] = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        this.whereInOrganization(
          and(
            eq(this.table.kind, "deployment_create"),
            eq(this.table.owner, owner),
            eq(this.table.dseq, dseq),
            this.#holdsChainDeposit(),
            ne(this.table.id, id)
          )
        )
      )
      .limit(1);

    return !!row;
  }

  /** The transactions another top-up into the deployment already holds, so one chain deposit backs one row. */
  async findClaimedTopUpTxHashes({ id, owner, dseq }: Pick<DeploymentDepositOutput, "id" | "owner" | "dseq">, txHashes: string[]): Promise<Set<string>> {
    if (!txHashes.length) return new Set();

    const rows = await this.cursor
      .select({ txHash: this.table.txHash })
      .from(this.table)
      .where(
        this.whereInOrganization(
          and(
            eq(this.table.kind, "top_up"),
            eq(this.table.owner, owner),
            eq(this.table.dseq, dseq),
            this.#holdsChainDeposit(),
            inArray(this.table.txHash, txHashes),
            ne(this.table.id, id)
          )
        )
      );

    return new Set(rows.map(({ txHash }) => txHash).filter((txHash): txHash is string => !!txHash));
  }

  /** A pending row with a hash is settled by that hash, so it holds its deposit just as a confirmed row does. */
  #holdsChainDeposit() {
    return or(eq(this.table.status, "confirmed"), and(eq(this.table.status, "pending"), isNotNull(this.table.txHash)));
  }

  /** A create's project is known before its deployment's record is written, so a top-up right after it can be filed there too. */
  async findCreateProjectIds(organizationId: string, owner: string, dseqs: string[]): Promise<Map<string, string>> {
    const projectIds = new Map<string, string>();

    if (!dseqs.length) return projectIds;

    const rows = await this.cursor
      .select({ dseq: this.table.dseq, projectId: this.table.projectId })
      .from(this.table)
      .where(
        this.whereInOrganization(
          and(
            eq(this.table.organizationId, organizationId),
            eq(this.table.kind, "deployment_create"),
            eq(this.table.owner, owner),
            inArray(this.table.dseq, dseqs),
            ne(this.table.status, "void")
          )
        )
      )
      .orderBy(asc(this.table.createdAt));

    for (const { dseq, projectId } of rows) {
      if (projectId && !projectIds.has(dseq)) projectIds.set(dseq, projectId);
    }

    return projectIds;
  }

  /** History before this point predates the ledger, so a report reads it from the chain index instead. */
  async findFirstRecordedAt(organizationId: string): Promise<Date | undefined> {
    const [row] = await this.cursor
      .select({ firstRecordedAt: min(this.table.createdAt) })
      .from(this.table)
      .where(this.whereInOrganization(eq(this.table.organizationId, organizationId)));

    return row?.firstRecordedAt ?? undefined;
  }

  async sumCommittedInProject(organizationId: string, projectId: string, { from, to }: SpendWindow): Promise<number> {
    const [row] = await this.cursor
      .select({ amountCents: sql<string | null>`sum(${this.table.amountCents})` })
      .from(this.table)
      .where(
        this.whereInOrganization(
          and(
            eq(this.table.organizationId, organizationId),
            eq(this.table.projectId, projectId),
            ne(this.table.status, "void"),
            gte(this.table.createdAt, from),
            lt(this.table.createdAt, to)
          )
        )
      );

    return Number(row?.amountCents ?? 0);
  }

  async sumCommittedByProject(organizationId: string, { from, to }: SpendWindow): Promise<CommittedSpend[]> {
    const rows = await this.cursor
      .select({ projectId: this.table.projectId, amountCents: sql<string>`sum(${this.table.amountCents})` })
      .from(this.table)
      .where(
        this.whereInOrganization(
          and(eq(this.table.organizationId, organizationId), ne(this.table.status, "void"), gte(this.table.createdAt, from), lt(this.table.createdAt, to))
        )
      )
      .groupBy(this.table.projectId);

    return rows.map(({ projectId, amountCents }) => ({ projectId, amountCents: Number(amountCents) }));
  }
}
