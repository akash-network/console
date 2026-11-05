import { desc, eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantConsents"];
export type AssistantConsentInput = Partial<Table["$inferInsert"]>;
export type AssistantConsentOutput = Table["$inferSelect"];

@singleton()
export class AssistantConsentRepository extends BaseRepository<Table, AssistantConsentInput, AssistantConsentOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantConsents") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "AssistantConsent", "AssistantConsents");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AssistantConsentRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findLatestByUserId(userId: string): Promise<AssistantConsentOutput | undefined> {
    const [latest] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)))
      .orderBy(desc(this.table.createdAt))
      .limit(1);

    return latest;
  }
}
