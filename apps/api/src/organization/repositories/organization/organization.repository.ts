import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["Organizations"];
export type OrganizationInput = Table["$inferInsert"];
export type OrganizationOutput = Table["$inferSelect"];

export type PersonalOrganizationInput = Pick<OrganizationInput, "name" | "slug"> & { createdByUserId: string };

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
}
