import { and, eq } from "drizzle-orm";
import first from "lodash/first";
import { singleton } from "tsyringe";

import { InjectUserWalletSchema, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { TxService } from "@src/core/services";

export type UserInput = Partial<UserWalletSchema["$inferInsert"]>;
export type DbUserOutput = UserWalletSchema["$inferSelect"];
export type UserOutput = DbUserOutput & {
  creditAmount: number;
};

export interface ListOptions {
  limit?: number;
  offset?: number;
}

@singleton()
export class UserWalletRepository {
  get cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectUserWalletSchema() private readonly userWallet: UserWalletSchema,
    private readonly txManager: TxService
  ) {}

  async create(input: Pick<UserInput, "userId" | "address">) {
    return this.toOutput(
      first(
        await this.cursor
          .insert(this.userWallet)
          .values({
            userId: input.userId,
            address: input.address
          })
          .returning()
      )
    );
  }

  async updateById(id: UserOutput["id"], payload: Partial<UserInput>, options?: { returning: true }): Promise<UserOutput>;
  async updateById(id: UserOutput["id"], payload: Partial<UserInput>): Promise<void>;
  async updateById(id: UserOutput["id"], payload: Partial<UserInput>, options?: { returning: boolean }): Promise<void | UserOutput> {
    const cursor = this.cursor.update(this.userWallet).set(payload).where(eq(this.userWallet.id, id));

    if (options?.returning) {
      const items = await cursor.returning();
      return this.toOutput(first(items));
    }

    await cursor;

    return undefined;
  }

  async find(query?: Partial<DbUserOutput>) {
    const fields = query && (Object.keys(query) as Array<keyof DbUserOutput>);
    const where = fields.length ? and(...fields.map(field => eq(this.userWallet[field], query[field]))) : undefined;

    return this.toOutputList(
      await this.cursor.query.userWalletSchema.findMany({
        where
      })
    );
  }

  async findByUserId(userId: UserOutput["userId"]) {
    return await this.cursor.query.userWalletSchema.findFirst({ where: eq(this.userWallet.userId, userId) });
  }

  private toOutputList(dbOutput: UserWalletSchema["$inferSelect"][]): UserOutput[] {
    return dbOutput.map(item => this.toOutput(item));
  }

  private toOutput(dbOutput: UserWalletSchema["$inferSelect"]): UserOutput {
    return {
      ...dbOutput,
      creditAmount: parseFloat(dbOutput.deploymentAllowance) + parseFloat(dbOutput.feeAllowance)
    };
  }
}
