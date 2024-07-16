import { and, eq, isNull } from "drizzle-orm";
import first from "lodash/first";
import { singleton } from "tsyringe";

import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { TxService } from "@src/core/services";
import { InjectUserSchema, UserSchema } from "@src/user/providers";

export type UserOutput = UserSchema["$inferSelect"];

@singleton()
export class UserRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectUserSchema() private readonly users: UserSchema,
    private readonly txManager: TxService
  ) {}

  async create() {
    const pg = this.txManager.getPgTx() || this.pg;
    return first(await pg.insert(this.users).values({}).returning({ id: this.users.id }));
  }

  async findAnonymousById(id: UserOutput["id"]) {
    return await this.pg.query.userSchema.findFirst({ where: and(eq(this.users.id, id), isNull(this.users.userId)), columns: { id: true } });
  }
}
