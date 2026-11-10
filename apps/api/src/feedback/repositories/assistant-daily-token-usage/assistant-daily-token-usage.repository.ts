import { eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantDailyTokenUsage"];
export type AssistantDailyTokenUsageOutput = Table["$inferSelect"];

@singleton()
export class AssistantDailyTokenUsageRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantDailyTokenUsage") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async add(day: string, usage: { promptTokens: number; completionTokens: number }): Promise<number> {
    const [row] = await this.#cursor
      .insert(this.table)
      .values({ day, ...usage })
      .onConflictDoUpdate({
        target: this.table.day,
        set: {
          promptTokens: sql`${this.table.promptTokens} + excluded.prompt_tokens`,
          completionTokens: sql`${this.table.completionTokens} + excluded.completion_tokens`,
          updatedAt: sql`now()`
        }
      })
      .returning({ promptTokens: this.table.promptTokens, completionTokens: this.table.completionTokens });

    return row.promptTokens + row.completionTokens;
  }

  async totalOn(day: string): Promise<number> {
    const [row] = await this.#cursor
      .select({ promptTokens: this.table.promptTokens, completionTokens: this.table.completionTokens })
      .from(this.table)
      .where(eq(this.table.day, day));

    return row ? row.promptTokens + row.completionTokens : 0;
  }
}
