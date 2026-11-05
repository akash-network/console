import { asc, eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantMessages"];
export type AssistantMessageInput = Partial<Table["$inferInsert"]>;
export type AssistantMessageOutput = Table["$inferSelect"];

@singleton()
export class AssistantMessageRepository extends BaseRepository<Table, AssistantMessageInput, AssistantMessageOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantMessages") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "AssistantMessage", "AssistantMessages");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AssistantMessageRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findAllOf(conversationId: string): Promise<AssistantMessageOutput[]> {
    return await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.conversationId, conversationId)))
      .orderBy(asc(this.table.createdAt));
  }
}
