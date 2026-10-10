import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { Users } from "@src/user/model-schemas/user/user.schema";

type Table = ApiPgTables["Organizations"];
export type OrganizationInput = Table["$inferInsert"];
export type OrganizationOutput = Table["$inferSelect"];

export type PersonalOrganizationInput = Pick<OrganizationInput, "name" | "slug"> & { createdByUserId: string };

export type TeamOrganizationInput = Pick<OrganizationInput, "name"> & { createdByUserId: string };

export type PersonalOrganizationClaim = { organization: OrganizationOutput; isNew: boolean };

@singleton()
export class OrganizationRepository extends BaseRepository<Table, OrganizationInput, OrganizationOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Organizations") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "Organization", "Organizations");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new OrganizationRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** The partial unique index decides who creates the user's personal organization; nothing comes back when the slug belongs to another organization. */
  async createPersonalUnlessExists(input: PersonalOrganizationInput): Promise<PersonalOrganizationClaim | undefined> {
    const values = { ...input, type: "personal" as const };
    this.ability?.throwUnlessCanExecute(values);
    const [created] = await this.cursor.insert(this.table).values(values).onConflictDoNothing().returning();

    if (created) {
      return { organization: this.toOutput(created), isNew: true };
    }

    const existing = await this.findPersonalByUserId(input.createdByUserId);

    return existing && { organization: existing, isNew: false };
  }

  async findPersonalByUserId(userId: string): Promise<OrganizationOutput | undefined> {
    return this.findOneBy({ createdByUserId: userId, type: "personal" });
  }

  /** Takes the first slug no organization holds, deleted ones included; nothing comes back when every slug is taken. */
  async createTeamWithFirstFreeSlug(input: TeamOrganizationInput, slugs: string[]): Promise<OrganizationOutput | undefined> {
    for (const slug of slugs) {
      const [created] = await this.cursor
        .insert(this.table)
        .values({ ...input, slug, type: "team" })
        .onConflictDoNothing({ target: this.table.slug })
        .returning();

      if (created) return this.toOutput(created);
    }

    return undefined;
  }

  async countTeamsCreatedBy(userId: string): Promise<number> {
    return await this.count({ createdByUserId: userId, type: "team" });
  }

  /** Row-locks the user until the ambient transaction ends, so the organizations they create or rename are checked one change at a time. */
  async lockUserForOrganizationChanges(userId: string): Promise<void> {
    const tx = this.txManager.getPgTx();

    if (!tx) {
      throw new Error(`Organization changes of user ${userId} can only be locked inside a transaction`);
    }

    await tx.select({ id: Users.id }).from(Users).where(eq(Users.id, userId)).for("no key update");
  }
}
