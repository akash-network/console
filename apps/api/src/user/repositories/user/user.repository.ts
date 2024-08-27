import { and, eq, isNull } from "drizzle-orm";
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
}
