import { eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantDailyTokenUsage"];
export type AssistantDailyTokenUsageOutput = Table["$inferSelect"];

export interface AssistantDayTokenTotals {
  total: number;
  trialTotal: number;
}

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

  async add(day: string, usage: { promptTokens: number; completionTokens: number }, { isTrial }: { isTrial: boolean }): Promise<AssistantDayTokenTotals> {
    const trialTokens = isTrial ? usage.promptTokens + usage.completionTokens : 0;
    const [row] = await this.#cursor
      .insert(this.table)
      .values({ day, ...usage, trialTokens })
      .onConflictDoUpdate({
        target: this.table.day,
        set: {
          promptTokens: sql`${this.table.promptTokens} + excluded.prompt_tokens`,
          completionTokens: sql`${this.table.completionTokens} + excluded.completion_tokens`,
          trialTokens: sql`${this.table.trialTokens} + excluded.trial_tokens`,
          updatedAt: sql`now()`
        }
      })
      .returning(this.#totalColumns);

    return totalsOf(row);
  }

  async totalsOn(day: string): Promise<AssistantDayTokenTotals> {
    const [row] = await this.#cursor.select(this.#totalColumns).from(this.table).where(eq(this.table.day, day));

    return row ? totalsOf(row) : { total: 0, trialTotal: 0 };
  }

  get #totalColumns() {
    return { promptTokens: this.table.promptTokens, completionTokens: this.table.completionTokens, trialTokens: this.table.trialTokens };
  }
}

function totalsOf(row: { promptTokens: number; completionTokens: number; trialTokens: number }): AssistantDayTokenTotals {
  return { total: row.promptTokens + row.completionTokens, trialTotal: row.trialTokens };
}
