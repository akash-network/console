import { and, desc, eq, exists, inArray, lt, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import type { ActivityPosition } from "@src/activity/lib/activity-cursor/activity-cursor";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationInvitations } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
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

  /** Matches invited addresses through the invitations the member accepted, which deleting the user row unlinks, so it must run first. */
  async redactMember(userId: string): Promise<void> {
    await this.#redactInvitedAddressesOf(userId);
    await this.#redactAccessChangesOf(userId);
  }

  async #redactInvitedAddressesOf(userId: string): Promise<void> {
    const acceptedInvitationToSameAddress = this.cursor
      .select({ id: OrganizationInvitations.id })
      .from(OrganizationInvitations)
      .where(
        and(
          eq(OrganizationInvitations.acceptedByUserId, userId),
          eq(OrganizationInvitations.organizationId, this.table.organizationId),
          eq(OrganizationInvitations.email, sql`${this.table.payload} ->> 'email'`)
        )
      );

    await this.cursor
      .update(this.table)
      .set({ payload: sql`${this.table.payload} - 'email'` })
      .where(this.unscoped("account-deletion").whereAccessibleBy(and(eq(this.table.type, "member_invited"), exists(acceptedInvitationToSameAddress))));
  }

  async #redactAccessChangesOf(userId: string): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ payload: sql`${this.table.payload} - 'userId' - 'username'` })
      .where(
        this.unscoped("account-deletion").whereAccessibleBy(
          and(inArray(this.table.type, ["member_granted", "member_revoked", "member_updated"]), sql`${this.table.payload} ->> 'userId' = ${userId}`)
        )
      );
  }

  #isOlderThan({ createdAt, id }: ActivityPosition) {
    const at = new Date(createdAt);
    return or(lt(this.table.createdAt, at), and(eq(this.table.createdAt, at), lt(this.table.id, id)));
  }
}
