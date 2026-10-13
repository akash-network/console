import { and, asc, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["OrganizationMembers"];
export type OrganizationMemberInput = Table["$inferInsert"];
export type OrganizationMemberOutput = Table["$inferSelect"];

export type OrganizationMemberWithUser = Pick<OrganizationMemberOutput, "id" | "userId" | "role" | "createdAt"> & {
  username: string | null;
  email: string | null;
};

export type OrganizationLookup = { id: string } | { slug: string } | { idOrSlug: string } | { type: "personal" };

export interface Membership {
  role: OrganizationRole;
  organization: ApiPgTables["Organizations"]["$inferSelect"];
}

@singleton()
export class OrganizationMemberRepository extends OrgScopedRepository<Table, OrganizationMemberInput, OrganizationMemberOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("OrganizationMembers") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "OrganizationMember", "OrganizationMembers");
  }

  protected newInstance() {
    return new OrganizationMemberRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  /** Returns nothing when the user is already a member, so a repeated call never aborts the caller's transaction. */
  async createUnlessExists(input: Pick<OrganizationMemberInput, "organizationId" | "userId" | "role">): Promise<OrganizationMemberOutput | undefined> {
    const values = await this.attributeToOrganization(input);
    this.ability?.throwUnlessCanExecute(values);
    const [created] = await this.cursor
      .insert(this.table)
      .values(values)
      .onConflictDoNothing({ target: [this.table.organizationId, this.table.userId] })
      .returning();

    return created && this.toOutput(created);
  }

  /** Row-locks the organization's owners until the ambient transaction ends, so concurrent role changes serialize on them. */
  async lockOwners(organizationId: OrganizationMemberOutput["organizationId"]): Promise<OrganizationMemberOutput[]> {
    const tx = this.txManager.getPgTx();

    if (!tx) {
      throw new Error(`Owners of organization ${organizationId} can only be locked inside a transaction`);
    }

    const owners = await tx
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.organizationId, organizationId), eq(this.table.role, "owner"))))
      .orderBy(asc(this.table.id))
      .for("update");

    return this.toOutputList(owners);
  }

  async findAllWithUsers(organizationId: OrganizationMemberOutput["organizationId"]): Promise<OrganizationMemberWithUser[]> {
    return await this.#selectWithUsers(eq(this.table.organizationId, organizationId)).orderBy(asc(this.table.createdAt), asc(this.table.id));
  }

  async findWithUserById(id: OrganizationMemberOutput["id"]): Promise<OrganizationMemberWithUser | undefined> {
    const [member] = await this.#selectWithUsers(eq(this.table.id, id));

    return member;
  }

  #selectWithUsers(where: SQL) {
    return this.cursor
      .select({
        id: this.table.id,
        userId: this.table.userId,
        role: this.table.role,
        createdAt: this.table.createdAt,
        username: Users.username,
        email: Users.email
      })
      .from(this.table)
      .innerJoin(Users, eq(Users.id, this.table.userId))
      .where(this.whereAccessibleBy(where))
      .$dynamic();
  }

  async findEmailsOfMembers(organizationId: OrganizationMemberOutput["organizationId"], emails: string[]): Promise<string[]> {
    const members = await this.cursor
      .select({ email: sql<string>`lower(${Users.email})` })
      .from(this.table)
      .innerJoin(Users, eq(Users.id, this.table.userId))
      .where(this.whereAccessibleBy(and(eq(this.table.organizationId, organizationId), inArray(sql`lower(${Users.email})`, emails))));

    return members.map(member => member.email);
  }

  async findActiveMembership(userId: OrganizationMemberOutput["userId"], lookup: OrganizationLookup): Promise<Membership | undefined> {
    const [membership] = await this.#selectActiveMemberships(and(eq(this.table.userId, userId), organizationMatching(userId, lookup)));

    return membership;
  }

  async findActiveMemberships(userId: OrganizationMemberOutput["userId"]): Promise<Membership[]> {
    return await this.#selectActiveMemberships(eq(this.table.userId, userId)).orderBy(
      asc(Organizations.type),
      asc(Organizations.createdAt),
      asc(Organizations.id)
    );
  }

  #selectActiveMemberships(where: SQL | undefined) {
    return this.cursor
      .select({ role: this.table.role, organization: Organizations })
      .from(this.table)
      .innerJoin(Organizations, eq(Organizations.id, this.table.organizationId))
      .where(this.unscoped("own-memberships").whereAccessibleBy(and(where, isNull(Organizations.deletedAt))))
      .$dynamic();
  }
}

function organizationMatching(userId: string, lookup: OrganizationLookup): SQL | undefined {
  if ("id" in lookup) return eq(Organizations.id, lookup.id);
  if ("slug" in lookup) return eq(Organizations.slug, lookup.slug);
  if ("idOrSlug" in lookup) return or(eq(Organizations.id, lookup.idOrSlug), eq(Organizations.slug, lookup.idOrSlug));

  return and(eq(Organizations.type, "personal"), eq(Organizations.createdByUserId, userId));
}
