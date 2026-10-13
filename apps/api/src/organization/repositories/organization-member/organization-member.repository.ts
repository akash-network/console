import { and, eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["OrganizationMembers"];
export type OrganizationMemberInput = Table["$inferInsert"];
export type OrganizationMemberOutput = Table["$inferSelect"];

@singleton()
export class OrganizationMemberRepository extends BaseRepository<Table, OrganizationMemberInput, OrganizationMemberOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("OrganizationMembers") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "OrganizationMember", "OrganizationMembers");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new OrganizationMemberRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Returns nothing when the user is already a member, so a repeated call never aborts the caller's transaction. */
  async createUnlessExists(input: Pick<OrganizationMemberInput, "organizationId" | "userId" | "role">): Promise<OrganizationMemberOutput | undefined> {
    this.ability?.throwUnlessCanExecute(input);
    const [created] = await this.cursor
      .insert(this.table)
      .values(input)
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
      .where(and(eq(this.table.organizationId, organizationId), eq(this.table.role, "owner")))
      .for("update");

    return this.toOutputList(owners);
  }
}
