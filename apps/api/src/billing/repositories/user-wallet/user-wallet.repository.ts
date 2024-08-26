import { eq, lte, or } from "drizzle-orm";
import first from "lodash/first";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { InjectUserWalletSchema, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, InjectPg } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type DbUserWalletInput = Partial<UserWalletSchema["$inferInsert"]>;
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
export class UserWalletRepository extends BaseRepository<UserWalletSchema, UserWalletInput, UserWalletOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectUserWalletSchema() protected readonly schema: UserWalletSchema,
    protected readonly txManager: TxService
  ) {
    super(pg, schema, txManager, "UserWallet", "userWalletSchema");
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

  async findDrainingWallets(thresholds = { fee: 0, deployment: 0 }, options?: Pick<ListOptions, "limit">) {
    const where = or(lte(this.schema.deploymentAllowance, thresholds.deployment.toString()), lte(this.schema.feeAllowance, thresholds.fee.toString()));

    return this.toOutputList(
      await this.cursor.query.userWalletSchema.findMany({
        where: this.whereAccessibleBy(where),
        limit: options?.limit || 10
      })
    );
  }

  async findByUserId(userId: UserWalletOutput["userId"]) {
    return this.toOutput(await this.cursor.query.userWalletSchema.findFirst({ where: this.whereAccessibleBy(eq(this.schema.userId, userId)) }));
  }

  protected toOutput(dbOutput: DbUserWalletOutput): UserWalletOutput {
    return (
      dbOutput && {
        ...dbOutput,
        creditAmount: parseFloat(dbOutput.deploymentAllowance),
        deploymentAllowance: parseFloat(dbOutput.deploymentAllowance),
        feeAllowance: parseFloat(dbOutput.feeAllowance)
      }
    );
  }

  protected toInput({ deploymentAllowance, feeAllowance, ...input }: UserWalletInput): DbUserWalletInput {
    const dbInput: DbUserWalletInput = {
      ...input,
      updatedAt: new Date()
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
