import { and, asc, desc, eq, gt, isNull, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { HardwareRequestEvents, type HardwareRequestLane, type HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

type Table = ApiPgTables["HardwareRequests"];
export type HardwareRequestInput = Partial<Table["$inferInsert"]>;
export type HardwareRequestDbOutput = Table["$inferSelect"];

export type HardwareRequestOutput = Omit<HardwareRequestDbOutput, "createdAt" | "updatedAt" | "firstRepliedAt"> & {
  createdAt: string;
  updatedAt: string;
  firstRepliedAt: string | null;
};

export type HardwareRequestQueueFilters = {
  lane?: HardwareRequestLane;
  status?: HardwareRequestStatus;
  owner?: string;
  unowned?: boolean;
  gpuModel?: string;
  order: "newest" | "oldest";
  limit: number;
  offset: number;
};

export type QueuedHardwareRequest = HardwareRequestOutput & { organizationName: string | null; lastRepliedAt: string | null };

const MAX_LISTED_REQUESTS = 100;

@singleton()
export class HardwareRequestRepository extends OrgScopedRepository<Table, HardwareRequestInput, HardwareRequestOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("HardwareRequests") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "HardwareRequest", "HardwareRequests");
  }

  protected newInstance() {
    return new HardwareRequestRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findCreationTimesSince(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.cursor
      .select({ createdAt: this.table.createdAt })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), gt(this.table.createdAt, since)))
      .orderBy(asc(this.table.createdAt));

    return rows.map(row => row.createdAt);
  }

  async findNewestFirst(): Promise<HardwareRequestOutput[]> {
    const rows = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(undefined))
      .orderBy(desc(this.table.createdAt))
      .limit(MAX_LISTED_REQUESTS);

    return this.toOutputList(rows);
  }

  async findQueue(filters: HardwareRequestQueueFilters): Promise<QueuedHardwareRequest[]> {
    const { lane, status, owner, unowned, gpuModel, order, limit, offset } = filters;
    const rows = await this.#selectQueued()
      .where(
        this.whereAccessibleBy(
          and(
            lane ? eq(this.table.lane, lane) : undefined,
            status ? eq(this.table.status, status) : undefined,
            owner ? eq(this.table.owner, owner) : undefined,
            unowned ? isNull(this.table.owner) : undefined,
            gpuModel ? sql`lower(${this.table.gpuModel}) = lower(${gpuModel})` : undefined
          )
        )
      )
      .orderBy(order === "oldest" ? asc(this.table.createdAt) : desc(this.table.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(row => this.#toQueued(row));
  }

  /** A reply is anything the team sent the tenant, which notes and ownership changes are not. */
  #selectQueued() {
    const lastRepliedAt: SQL<Date | null> = sql`(select max(${HardwareRequestEvents.createdAt}) from ${HardwareRequestEvents} where ${HardwareRequestEvents.hardwareRequestId} = ${this.table.id} and ${HardwareRequestEvents.type} in ('status_changed', 'offer_published'))`;

    return this.cursor
      .select({ request: this.table, organizationName: Organizations.name, lastRepliedAt: lastRepliedAt.mapWith(HardwareRequestEvents.createdAt) })
      .from(this.table)
      .leftJoin(Organizations, eq(Organizations.id, this.table.organizationId));
  }

  #toQueued({ request, organizationName, lastRepliedAt }: { request: HardwareRequestDbOutput; organizationName: string | null; lastRepliedAt: Date | null }) {
    return { ...this.toOutput(request), organizationName, lastRepliedAt: lastRepliedAt?.toISOString() ?? null };
  }

  protected toOutput(payload: HardwareRequestDbOutput): HardwareRequestOutput {
    return {
      ...payload,
      createdAt: payload.createdAt.toISOString(),
      updatedAt: payload.updatedAt.toISOString(),
      firstRepliedAt: payload.firstRepliedAt?.toISOString() ?? null
    };
  }
}
