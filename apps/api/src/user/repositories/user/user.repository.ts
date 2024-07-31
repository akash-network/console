import { and, eq, isNull } from "drizzle-orm";
import first from "lodash/first";
import { singleton } from "tsyringe";

import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { InjectUserSchema, UserSchema } from "@src/user/providers";

export type UserOutput = UserSchema["$inferSelect"];

@singleton()
export class UserRepository extends BaseRepository<UserSchema> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectUserSchema() protected readonly schema: UserSchema,
    protected readonly txManager: TxService
  ) {
    super(pg, schema, txManager, "User");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserRepository(this.pg, this.schema, this.txManager).withAbility(...abilityParams) as this;
  }

  async create() {
    return first(await this.cursor.insert(this.schema).values({}).returning({ id: this.schema.id }));
  }

  async findByUserId(userId: UserOutput["userId"]) {
    return await this.cursor.query.userSchema.findFirst({ where: this.whereAccessibleBy(eq(this.schema.userId, userId)) });
  }

  async findById(id: UserOutput["id"]) {
    return await this.cursor.query.userSchema.findFirst({ where: this.whereAccessibleBy(eq(this.schema.id, id)) });
  }

  async findAnonymousById(id: UserOutput["id"]) {
    return await this.cursor.query.userSchema.findFirst({ where: this.whereAccessibleBy(and(eq(this.schema.id, id), isNull(this.schema.userId))) });
  }
}
