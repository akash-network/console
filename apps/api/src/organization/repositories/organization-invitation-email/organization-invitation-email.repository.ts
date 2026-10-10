import { and, asc, eq, gt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationInvitations } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";

type Table = ApiPgTables["OrganizationInvitationEmails"];
export type OrganizationInvitationEmailInput = Table["$inferInsert"];
export type OrganizationInvitationEmailOutput = Table["$inferSelect"];

export type InvitationEmailSend = { email: string; createdAt: Date };

@singleton()
export class OrganizationInvitationEmailRepository extends OrgScopedRepository<Table, OrganizationInvitationEmailInput, OrganizationInvitationEmailOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("OrganizationInvitationEmails") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "OrganizationInvitationEmail", "OrganizationInvitationEmails");
  }

  protected newInstance() {
    return new OrganizationInvitationEmailRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async recordSends(sends: Pick<OrganizationInvitationEmailInput, "organizationId" | "invitationId" | "sentByUserId">[]): Promise<void> {
    if (sends.length === 0) return;

    const values = await Promise.all(sends.map(send => this.attributeToOrganization(send)));
    await this.cursor.insert(this.table).values(values);
  }

  /** Counts sends by an inviter in every organization they belong to, not only the active one. */
  async findSendsSince(filter: { organizationId: string } | { sentByUserId: string }, since: Date): Promise<InvitationEmailSend[]> {
    return await this.cursor
      .select({ email: OrganizationInvitations.email, createdAt: this.table.createdAt })
      .from(this.table)
      .innerJoin(OrganizationInvitations, eq(OrganizationInvitations.id, this.table.invitationId))
      .where(this.unscoped("invitation-email-limits").whereAccessibleBy(and(sentBy(this.table, filter), gt(this.table.createdAt, since))))
      .orderBy(asc(this.table.createdAt));
  }
}

function sentBy(table: Table, filter: { organizationId: string } | { sentByUserId: string }) {
  return "organizationId" in filter ? eq(table.organizationId, filter.organizationId) : eq(table.sentByUserId, filter.sentByUserId);
}
