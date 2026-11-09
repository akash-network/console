import { and, desc, eq, inArray } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AccountStatusEvents"];
export type AccountStatusEventInput = Table["$inferInsert"];
export type AccountStatusEventOutput = Table["$inferSelect"];

@singleton()
export class AccountStatusEventRepository extends BaseRepository<Table, AccountStatusEventInput, AccountStatusEventOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("AccountStatusEvents") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "AccountStatusEvent", "AccountStatusEvents");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AccountStatusEventRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findLatestUserReasonOf(userId: string): Promise<string | null> {
    const [event] = await this.cursor
      .select({ userReason: this.table.userReason })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), inArray(this.table.action, ["suspend", "terminate"])))
      .orderBy(desc(this.table.createdAt))
      .limit(1);

    return event?.userReason ?? null;
  }

  async markNotificationSent(id: string): Promise<void> {
    await this.cursor.update(this.table).set({ notificationSentAt: new Date() }).where(eq(this.table.id, id));
  }
}
