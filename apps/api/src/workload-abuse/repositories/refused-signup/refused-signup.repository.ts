import { and, eq, gte, lt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["RefusedSignups"];
export type RefusedSignupInput = Partial<Table["$inferInsert"]>;
export type RefusedSignupOutput = Table["$inferSelect"];

@singleton()
export class RefusedSignupRepository extends BaseRepository<Table, RefusedSignupInput, RefusedSignupOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("RefusedSignups") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "RefusedSignup", "RefusedSignups");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new RefusedSignupRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async existsSince(browserHash: string, since: Date): Promise<boolean> {
    const [match] = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.browserHash, browserHash), gte(this.table.createdAt, since))))
      .limit(1);

    return !!match;
  }

  async deleteOlderThan(cutoff: Date): Promise<void> {
    await this.cursor.delete(this.table).where(this.whereAccessibleBy(lt(this.table.createdAt, cutoff)));
  }
}
