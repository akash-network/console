import { sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AssistantUserUsage"];
export type AssistantUserUsageOutput = Table["$inferSelect"];

export interface AssistantMessageCounts {
  dayMessageCount: number;
  minuteMessageCount: number;
}

@singleton()
export class AssistantUserUsageRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AssistantUserUsage") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Counts the message in one statement, so concurrent requests of one user never read the same count. */
  async countMessage(userId: string, sentAt: Date): Promise<AssistantMessageCounts> {
    const withinMinute = sql`${this.table.minuteStartedAt} > excluded.minute_started_at - interval '1 minute'`;
    const [counts] = await this.#cursor
      .insert(this.table)
      .values({ userId, day: sentAt.toISOString().slice(0, 10), dayMessageCount: 1, minuteStartedAt: sentAt, minuteMessageCount: 1 })
      .onConflictDoUpdate({
        target: this.table.userId,
        set: {
          dayMessageCount: sql`CASE WHEN ${this.table.day} = excluded.day THEN ${this.table.dayMessageCount} + 1 ELSE 1 END`,
          day: sql`excluded.day`,
          minuteMessageCount: sql`CASE WHEN ${withinMinute} THEN ${this.table.minuteMessageCount} + 1 ELSE 1 END`,
          minuteStartedAt: sql`CASE WHEN ${withinMinute} THEN ${this.table.minuteStartedAt} ELSE excluded.minute_started_at END`,
          updatedAt: sql`now()`
        }
      })
      .returning({ dayMessageCount: this.table.dayMessageCount, minuteMessageCount: this.table.minuteMessageCount });

    return counts;
  }
}
