import { and, asc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantConversations"];
export type AssistantConversationInput = Partial<Table["$inferInsert"]>;
export type AssistantConversationOutput = Table["$inferSelect"];

@singleton()
export class AssistantConversationRepository extends BaseRepository<Table, AssistantConversationInput, AssistantConversationOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantConversations") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "AssistantConversation", "AssistantConversations");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AssistantConversationRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Answers the themes the deleted conversations belonged to, since their counts no longer hold. */
  async deleteAllOf(userId: string): Promise<{ deletedCount: number; themeIds: string[] }> {
    const deleted = await this.cursor
      .delete(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)))
      .returning({ themeId: this.table.themeId });

    return { deletedCount: deleted.length, themeIds: deleted.flatMap(({ themeId }) => (themeId ? [themeId] : [])) };
  }

  /** Conversations that ended or went quiet, since an open one may still change how it is classified. */
  async findUnclassifiedIds(idleSince: Date, limit: number): Promise<string[]> {
    const rows = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(isNull(this.table.classifiedAt), or(isNotNull(this.table.endedAt), lt(this.table.lastMessageAt, idleSince))))
      .orderBy(asc(this.table.startedAt))
      .limit(limit);

    return rows.map(({ id }) => id);
  }
}
