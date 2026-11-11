import { and, asc, desc, eq, gt, gte, isNull, lte, not, notInArray, or, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { ResponseTarget } from "@src/hardware-request/lib/hardware-request-response-schedule/hardware-request-response-schedule";
import {
  HardwareRequestEvents,
  type HardwareRequestLane,
  HardwareRequestOffers,
  type HardwareRequestSpec,
  type HardwareRequestStatus
} from "@src/hardware-request/model-schemas";
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

type Table = ApiPgTables["HardwareRequests"];
export type HardwareRequestInput = Partial<Table["$inferInsert"]>;
export type HardwareRequestDbOutput = Table["$inferSelect"];

export type HardwareRequestOutput = Omit<HardwareRequestDbOutput, "createdAt" | "updatedAt" | "firstRepliedAt" | "firstReplyDueAt" | "firstOfferDueAt"> & {
  createdAt: string;
  updatedAt: string;
  firstRepliedAt: string | null;
  firstReplyDueAt: string | null;
  firstOfferDueAt: string | null;
};

export type HardwareRequestQueueFilters = {
  lane?: HardwareRequestLane;
  status?: HardwareRequestStatus;
  owner?: string;
  unowned?: boolean;
  gpuModel?: string;
  responseTarget?: ResponseTargetStanding;
  order: "newest" | "oldest";
  limit: number;
  offset: number;
};

export type RequestedHardware = { model: string; region: HardwareRequestSpec["region"] | null };

export type ResponseTargetStanding = "at_risk" | "missed";

export type QueuedHardwareRequest = HardwareRequestOutput & { organizationName: string | null; lastRepliedAt: string | null };

const MAX_LISTED_REQUESTS = 100;

const SETTLED_STATUSES: HardwareRequestStatus[] = ["accepted", "fulfilled", "withdrawn", "closed"];

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

  /** Reads only the model and region each request asks for, never who asked. */
  async findRequestedGpusSince(since: Date): Promise<RequestedHardware[]> {
    const model = sql<string>`coalesce(${this.table.spec} -> 'gpu' ->> 'model', ${this.table.gpuModel})`;
    const region = sql<RequestedHardware["region"]>`${this.table.spec} -> 'region'`;

    return await this.cursor
      .select({ model, region })
      .from(this.table)
      .where(this.whereAccessibleBy(and(gte(this.table.createdAt, since), sql`${model} is not null`)));
  }

  /** Hands the requests the team filed for an address with no account to the account that owns it. */
  async claimByContactEmail(email: string, owner: { userId: string; organizationId: string | null }): Promise<HardwareRequestOutput[]> {
    const rows = await this.updateWhere(
      this.whereAccessibleBy(and(isNull(this.table.userId), sql`lower(${this.table.contactEmail}) = ${email.trim().toLowerCase()}`)),
      { ...owner, updatedAt: new Date() },
      { returning: true }
    );

    return this.toOutputList(rows);
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
    const { lane, status, owner, unowned, gpuModel, responseTarget, order, limit, offset } = filters;
    const rows = await this.#selectQueued()
      .where(
        this.whereAccessibleBy(
          and(
            lane ? eq(this.table.lane, lane) : undefined,
            status ? eq(this.table.status, status) : undefined,
            owner ? eq(this.table.owner, owner) : undefined,
            unowned ? isNull(this.table.owner) : undefined,
            gpuModel ? sql`lower(${this.table.gpuModel}) = lower(${gpuModel})` : undefined,
            responseTarget ? this.#standingOn(responseTarget) : undefined
          )
        )
      )
      .orderBy(order === "oldest" ? asc(this.table.createdAt) : desc(this.table.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(row => this.#toQueued(row));
  }

  async findQueuedById(id: string): Promise<QueuedHardwareRequest | undefined> {
    const [row] = await this.#selectQueued()
      .where(this.whereAccessibleBy(eq(this.table.id, id)))
      .limit(1);

    return row && this.#toQueued(row);
  }

  /** Missed once a target is due unmet; at risk once its reminder went out with the target still unmet. */
  #standingOn(standing: ResponseTargetStanding): SQL | undefined {
    const replyOpen = isNull(this.table.firstRepliedAt);
    const offerOpen = not(
      sql`exists (select 1 from ${HardwareRequestOffers} where ${HardwareRequestOffers.hardwareRequestId} = ${this.table.id} and ${HardwareRequestOffers.publishedAt} is not null)`
    );
    const reminded = (target: ResponseTarget) =>
      sql`exists (select 1 from ${HardwareRequestEvents} where ${HardwareRequestEvents.hardwareRequestId} = ${this.table.id} and ${HardwareRequestEvents.type} = 'reminder_sent' and ${HardwareRequestEvents.payload} ->> 'target' = ${target})`;
    const missed = or(and(replyOpen, lte(this.table.firstReplyDueAt, sql`now()`)), and(offerOpen, lte(this.table.firstOfferDueAt, sql`now()`)));
    const atRisk = and(sql`not coalesce(${missed}, false)`, or(and(replyOpen, reminded("first_reply")), and(offerOpen, reminded("first_offer"))));

    return and(notInArray(this.table.status, SETTLED_STATUSES), standing === "missed" ? missed : atRisk);
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
      firstRepliedAt: payload.firstRepliedAt?.toISOString() ?? null,
      firstReplyDueAt: payload.firstReplyDueAt?.toISOString() ?? null,
      firstOfferDueAt: payload.firstOfferDueAt?.toISOString() ?? null
    };
  }
}
