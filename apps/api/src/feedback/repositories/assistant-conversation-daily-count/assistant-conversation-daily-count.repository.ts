import { sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantConversationDailyCounts"];
export type AssistantConversationDailyCountOutput = Table["$inferSelect"];

@singleton()
export class AssistantConversationDailyCountRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantConversationDailyCounts") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async countEnded(day: string, resolved: boolean): Promise<void> {
    await this.#cursor
      .insert(this.table)
      .values({ day, resolvedCount: resolved ? 1 : 0, unresolvedCount: resolved ? 0 : 1 })
      .onConflictDoUpdate({
        target: this.table.day,
        set: {
          resolvedCount: sql`${this.table.resolvedCount} + excluded.resolved_count`,
          unresolvedCount: sql`${this.table.unresolvedCount} + excluded.unresolved_count`,
          updatedAt: sql`now()`
        }
      });
  }
}
