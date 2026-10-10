import { and, asc, count, eq, inArray, type SQL } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["OrganizationInvitations"];
export type OrganizationInvitationInput = Table["$inferInsert"];
export type OrganizationInvitationOutput = Table["$inferSelect"];

export type OrganizationInvitationWithInviter = Pick<
  OrganizationInvitationOutput,
  "id" | "organizationId" | "email" | "role" | "projectGrants" | "createdAt" | "expiresAt"
> & {
  invitedBy: { id: string; username: string | null } | null;
};

type NewInvitation = Pick<OrganizationInvitationInput, "organizationId" | "email" | "role" | "projectGrants" | "tokenHash" | "expiresAt" | "invitedByUserId">;

@singleton()
export class OrganizationInvitationRepository extends OrgScopedRepository<Table, OrganizationInvitationInput, OrganizationInvitationOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("OrganizationInvitations") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "OrganizationInvitation", "OrganizationInvitations");
  }

  protected newInstance() {
    return new OrganizationInvitationRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  /** Skips every address that already has a pending invitation in its organization, so concurrent invitations never abort the caller's transaction. */
  async createUnlessPending(inputs: NewInvitation[]): Promise<OrganizationInvitationOutput[]> {
    if (inputs.length === 0) return [];

    const values = await Promise.all(inputs.map(input => this.attributeToOrganization(input)));
    values.forEach(value => this.ability?.throwUnlessCanExecute(value));
    const created = await this.cursor
      .insert(this.table)
      .values(values)
      .onConflictDoNothing({ target: [this.table.organizationId, this.table.email], where: eq(this.table.status, "pending") })
      .returning();

    return this.toOutputList(created);
  }

  async countPending(organizationId: OrganizationInvitationOutput["organizationId"]): Promise<number> {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.organizationId, organizationId), eq(this.table.status, "pending"))));

    return result.count;
  }

  async findPendingWithInviters(
    organizationId: OrganizationInvitationOutput["organizationId"],
    filter: { ids?: OrganizationInvitationOutput["id"][]; emails?: OrganizationInvitationOutput["email"][] } = {}
  ): Promise<OrganizationInvitationWithInviter[]> {
    const rows = await this.cursor
      .select({
        id: this.table.id,
        organizationId: this.table.organizationId,
        email: this.table.email,
        role: this.table.role,
        projectGrants: this.table.projectGrants,
        createdAt: this.table.createdAt,
        expiresAt: this.table.expiresAt,
        inviterId: Users.id,
        inviterUsername: Users.username
      })
      .from(this.table)
      .leftJoin(Users, eq(Users.id, this.table.invitedByUserId))
      .where(this.whereAccessibleBy(and(eq(this.table.organizationId, organizationId), eq(this.table.status, "pending"), matching(this.table, filter))))
      .orderBy(asc(this.table.createdAt), asc(this.table.id));

    return rows.map(({ inviterId, inviterUsername, ...invitation }) => ({
      ...invitation,
      invitedBy: inviterId ? { id: inviterId, username: inviterUsername } : null
    }));
  }

  /** Swaps the token only while the invitation still carries the expected one, so a token issued in between is never overwritten. */
  async replaceTokenHash(
    id: OrganizationInvitationOutput["id"],
    tokenHashes: { from: OrganizationInvitationOutput["tokenHash"]; to: OrganizationInvitationOutput["tokenHash"] }
  ): Promise<OrganizationInvitationOutput | undefined> {
    return await this.updateBy({ id, status: "pending", tokenHash: tokenHashes.from }, { tokenHash: tokenHashes.to }, { returning: true });
  }
}

function matching(table: Table, filter: { ids?: string[]; emails?: string[] }): SQL | undefined {
  return and(filter.ids && inArray(table.id, filter.ids), filter.emails && inArray(table.email, filter.emails));
}
