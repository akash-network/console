import { eq } from "drizzle-orm";
import first from "lodash/first";
import { singleton } from "tsyringe";

import { InjectUserWalletSchema, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { TxService } from "@src/core/services";

export type UserInput = Partial<UserWalletSchema["$inferInsert"]>;
export type UserOutput = Partial<UserWalletSchema["$inferSelect"]>;

@singleton()
export class UserWalletRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectUserWalletSchema() private readonly userWallet: UserWalletSchema,
    private readonly txManager: TxService
  ) {}

  async create(input: Pick<UserInput, "userId" | "address">) {
    const pg = this.txManager.getPgTx() || this.pg;
    return first(
      await pg
        .insert(this.userWallet)
        .values({
          userId: input.userId,
          address: input.address
        })
        .returning()
    );
  }

  async updateById<R extends boolean>(
    id: UserOutput["id"],
    payload: Partial<UserInput>,
    options?: { returning: R }
  ): Promise<R extends true ? UserOutput : void> {
    const pg = this.txManager.getPgTx() || this.pg;
    const cursor = pg.update(this.userWallet).set(payload).where(eq(this.userWallet.id, id));

    if (options?.returning === true) {
      first(await cursor.returning());
    }

    await cursor;

    return undefined;
  }

  async find() {
    return await this.pg.query.userWalletSchema.findMany();
  }

  async findByUserId(userId: UserOutput["userId"]) {
    return await this.pg.query.userWalletSchema.findFirst({ where: eq(this.userWallet.userId, userId) });
  }
}
