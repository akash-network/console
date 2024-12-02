import subDays from "date-fns/subDays";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import first from "lodash/first";
import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type UserOutput = ApiPgTables["Users"]["$inferSelect"];
export type UserInput = Partial<UserOutput>;

@singleton()
export class UserRepository extends BaseRepository<ApiPgTables["Users"], UserInput, UserOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Users") protected readonly table: ApiPgTables["Users"],
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "User", "Users");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async create(input: Partial<UserInput> = {}) {
    return first(await this.cursor.insert(this.table).values(input).returning());
  }

  async findByUserId(userId: UserOutput["userId"]) {
    return await this.cursor.query.Users.findFirst({ where: this.whereAccessibleBy(eq(this.table.userId, userId)) });
  }

  async findAnonymousById(id: UserOutput["id"]) {
    return await this.cursor.query.Users.findFirst({ where: this.whereAccessibleBy(and(eq(this.table.id, id), isNull(this.table.userId))) });
  }

  async markAsActive(id: UserOutput["id"]) {
    await this.cursor
      .update(this.table)
      .set({ lastActiveAt: sql`now()` })
      .where(eq(this.table.id, id));
  }

  async paginateStaleAnonymousUsers({ inactivityInDays, ...params }: { inactivityInDays: number; limit?: number }, cb: (page: UserOutput[]) => Promise<void>) {
    await this.paginateRaw({ where: and(isNull(this.table.userId), lte(this.table.lastActiveAt, subDays(new Date(), inactivityInDays))), ...params }, cb);
  }
}
