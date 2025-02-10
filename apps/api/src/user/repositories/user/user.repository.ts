import subDays from "date-fns/subDays";
import { and, desc, eq, isNull, lt, lte, sql } from "drizzle-orm";
import first from "lodash/first";
import last from "lodash/last";
import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type UserOutput = ApiPgTables["Users"]["$inferSelect"] & {
  trial?: boolean;
};
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
    const result = await this.cursor.query.Users.findFirst({
      where: this.whereAccessibleBy(eq(this.table.userId, userId)),
      with: {
        userWallets: {
          columns: {
            isTrialing: true
          }
        }
      }
    });

    if (!result) return undefined;

    return {
      ...result,
      trial: result.userWallets?.isTrialing ?? true
    };
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

  async paginateStaleAnonymousUsers(
    { inactivityInDays, limit = 100 }: { inactivityInDays: number; limit?: number },
    cb: (page: UserOutput[]) => Promise<void>
  ) {
    let lastId: string | undefined;

    do {
      const clauses = [isNull(this.table.userId), lte(this.table.lastActiveAt, subDays(new Date(), inactivityInDays))];

      if (lastId) {
        clauses.push(lt(this.table.id, lastId));
      }

      const items = this.toOutputList(await this.cursor.query.Users.findMany({ where: and(...clauses), limit, orderBy: [desc(this.table.id)] }));
      lastId = last(items)?.id;

      if (items.length) {
        await cb(items);
      }
    } while (lastId);
  }
}
