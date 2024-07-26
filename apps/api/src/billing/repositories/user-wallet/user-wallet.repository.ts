import { and, eq, lte, or } from "drizzle-orm";
import first from "lodash/first";
import { singleton } from "tsyringe";

import { InjectUserWalletSchema, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { TxService } from "@src/core/services";

export type UserWalletInput = Partial<UserWalletSchema["$inferInsert"]>;
export type DbUserWalletOutput = UserWalletSchema["$inferSelect"];
export type UserWalletOutput = DbUserWalletOutput & {
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

  async create(input: Pick<UserWalletInput, "userId" | "address">) {
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

  async updateById(id: UserWalletOutput["id"], payload: Partial<UserWalletInput>, options?: { returning: true }): Promise<UserWalletOutput>;
  async updateById(id: UserWalletOutput["id"], payload: Partial<UserWalletInput>): Promise<void>;
  async updateById(id: UserWalletOutput["id"], payload: Partial<UserWalletInput>, options?: { returning: boolean }): Promise<void | UserWalletOutput> {
    const cursor = this.cursor.update(this.userWallet).set(payload).where(eq(this.userWallet.id, id));

    if (options?.returning) {
      const items = await cursor.returning();
      return this.toOutput(first(items));
    }

    await cursor;

    return undefined;
  }

  async find(query?: Partial<DbUserWalletOutput>) {
    const fields = query && (Object.keys(query) as Array<keyof DbUserWalletOutput>);
    const where = fields?.length ? and(...fields.map(field => eq(this.userWallet[field], query[field]))) : undefined;

    return this.toOutputList(
      await this.cursor.query.userWalletSchema.findMany({
        where
      })
    );
  }

  async findDrainingWallets(thresholds = { fee: 0, deployment: 0 }, options?: Pick<ListOptions, "limit">) {
    return this.toOutputList(
      await this.cursor.query.userWalletSchema.findMany({
        where: or(lte(this.userWallet.deploymentAllowance, thresholds.deployment.toString()), lte(this.userWallet.feeAllowance, thresholds.fee.toString())),
        limit: options?.limit || 10
      })
    );
  }

  async findByUserId(userId: UserWalletOutput["userId"]) {
    return this.toOutput(await this.cursor.query.userWalletSchema.findFirst({ where: eq(this.userWallet.userId, userId) }));
  }

  private toOutputList(dbOutput: UserWalletSchema["$inferSelect"][]): UserWalletOutput[] {
    return dbOutput.map(item => this.toOutput(item));
  }

  private toOutput(dbOutput: UserWalletSchema["$inferSelect"]): UserWalletOutput {
    return {
      ...dbOutput,
      creditAmount: parseFloat(dbOutput.deploymentAllowance) + parseFloat(dbOutput.feeAllowance)
    };
  }
}
