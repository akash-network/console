import { and, eq, lte, or } from "drizzle-orm";
import first from "lodash/first";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { InjectUserWalletSchema, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type DbUserWalletInput = Partial<UserWalletSchema["$inferSelect"]>;
export type UserWalletInput = Partial<
  Omit<DbUserWalletInput, "deploymentAllowance" | "feeAllowance"> & {
    deploymentAllowance: number;
    feeAllowance: number;
  }
>;
export type DbUserWalletOutput = UserWalletSchema["$inferSelect"];
export type UserWalletOutput = Omit<DbUserWalletOutput, "feeAllowance" | "deploymentAllowance"> & {
  creditAmount: number;
  deploymentAllowance: number;
  feeAllowance: number;
};

export interface ListOptions {
  limit?: number;
  offset?: number;
}

@singleton()
export class UserWalletRepository extends BaseRepository<UserWalletSchema> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectUserWalletSchema() protected readonly schema: UserWalletSchema,
    protected readonly txManager: TxService
  ) {
    super(pg, schema, txManager, "UserWallet");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserWalletRepository(this.pg, this.schema, this.txManager).withAbility(...abilityParams) as this;
  }

  async create(input: Pick<UserWalletInput, "userId" | "address">) {
    const value = {
      userId: input.userId,
      address: input.address
    };

    this.ability?.throwUnlessCanExecute(value);

    return this.toOutput(first(await this.cursor.insert(this.schema).values(value).returning()));
  }

  async updateById(id: UserWalletOutput["id"], payload: Partial<UserWalletInput>, options?: { returning: true }): Promise<UserWalletOutput>;
  async updateById(id: UserWalletOutput["id"], payload: Partial<UserWalletInput>): Promise<void>;
  async updateById(id: UserWalletOutput["id"], payload: Partial<UserWalletInput>, options?: { returning: boolean }): Promise<void | UserWalletOutput> {
    const cursor = this.cursor
      .update(this.schema)
      .set(this.toInput(payload))
      .where(this.whereAccessibleBy(eq(this.schema.id, id)));

    if (options?.returning) {
      const items = await cursor.returning();
      return this.toOutput(first(items));
    }

    await cursor;

    return undefined;
  }

  async find(query?: Partial<DbUserWalletOutput>) {
    const fields = query && (Object.keys(query) as Array<keyof DbUserWalletOutput>);
    const where = fields?.length ? and(...fields.map(field => eq(this.schema[field], query[field]))) : undefined;

    return this.toOutputList(
      await this.cursor.query.userWalletSchema.findMany({
        where: this.whereAccessibleBy(where)
      })
    );
  }

  async findDrainingWallets(thresholds = { fee: 0, deployment: 0 }, options?: Pick<ListOptions, "limit">) {
    const where = or(lte(this.schema.deploymentAllowance, thresholds.deployment.toString()), lte(this.schema.feeAllowance, thresholds.fee.toString()));

    return this.toOutputList(
      await this.cursor.query.userWalletSchema.findMany({
        where: this.whereAccessibleBy(where),
        limit: options?.limit || 10
      })
    );
  }

  async findById(id: UserWalletOutput["id"]) {
    return this.toOutput(await this.cursor.query.userWalletSchema.findFirst({ where: this.whereAccessibleBy(eq(this.schema.id, id)) }));
  }

  async findByUserId(userId: UserWalletOutput["userId"]) {
    return this.toOutput(await this.cursor.query.userWalletSchema.findFirst({ where: this.whereAccessibleBy(eq(this.schema.userId, userId)) }));
  }

  private toOutputList(dbOutput: UserWalletSchema["$inferSelect"][]): UserWalletOutput[] {
    return dbOutput.map(item => this.toOutput(item));
  }

  private toOutput(dbOutput?: UserWalletSchema["$inferSelect"]): UserWalletOutput {
    return (
      dbOutput && {
        ...dbOutput,
        creditAmount: parseFloat(dbOutput.deploymentAllowance),
        deploymentAllowance: parseFloat(dbOutput.deploymentAllowance),
        feeAllowance: parseFloat(dbOutput.feeAllowance)
      }
    );
  }

  private toInput({ deploymentAllowance, feeAllowance, ...input }: UserWalletInput): DbUserWalletInput {
    const dbInput: DbUserWalletInput = {
      ...input
    };

    if (deploymentAllowance) {
      dbInput.deploymentAllowance = deploymentAllowance.toString();
    }

    if (feeAllowance) {
      dbInput.feeAllowance = feeAllowance.toString();
    }
    return dbInput;
  }

  toPublic<T extends UserWalletOutput>(output: T): Pick<T, "id" | "userId" | "address" | "creditAmount" | "isTrialing"> {
    return pick(output, ["id", "userId", "address", "creditAmount", "isTrialing"]);
  }
}
