import { and, desc, eq, lt, or } from "drizzle-orm";
import { singleton } from "tsyringe";

import type { ActivityPosition } from "@src/activity/lib/activity-cursor/activity-cursor";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["OrganizationActivities"];
export type OrganizationActivityInput = Table["$inferInsert"];
export type OrganizationActivityOutput = Table["$inferSelect"];

export type OrganizationActivityWithActor = OrganizationActivityOutput & { actor: { id: string; username: string | null } | null };

@singleton()
export class OrganizationActivityRepository extends OrgScopedRepository<Table, OrganizationActivityInput, OrganizationActivityOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("OrganizationActivities") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "OrganizationActivity", "OrganizationActivities");
  }

  protected newInstance() {
    return new OrganizationActivityRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findPage({ limit, after, projectId }: { limit: number; after?: ActivityPosition; projectId?: string }): Promise<OrganizationActivityWithActor[]> {
    const rows = await this.cursor
      .select({ activity: this.table, actor: { id: Users.id, username: Users.username } })
      .from(this.table)
      .leftJoin(Users, eq(Users.id, this.table.actorUserId))
      .where(this.whereAccessibleBy(and(projectId ? eq(this.table.projectId, projectId) : undefined, after ? this.#isOlderThan(after) : undefined)))
      .orderBy(desc(this.table.createdAt), desc(this.table.id))
      .limit(limit);

    return rows.map(({ activity, actor }) => ({ ...this.toOutput(activity), actor }));
  }

  #isOlderThan({ createdAt, id }: ActivityPosition) {
    const at = new Date(createdAt);
    return or(lt(this.table.createdAt, at), and(eq(this.table.createdAt, at), lt(this.table.id, id)));
  }
}
