import { and, count, eq, inArray, lte } from "drizzle-orm";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

export type DbUserWalletInput = Partial<ApiPgTables["UserWallets"]["$inferInsert"]>;
export type UserWalletInput = Partial<
  Omit<DbUserWalletInput, "deploymentAllowance" | "feeAllowance"> & {
    deploymentAllowance: number;
    feeAllowance: number;
  }
>;
export type DbUserWalletOutput = ApiPgTables["UserWallets"]["$inferSelect"];
export type UserWalletOutput = Omit<DbUserWalletOutput, "feeAllowance" | "deploymentAllowance"> & {
  creditAmount: number;
  deploymentAllowance: number;
  feeAllowance: number;
};

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export type UserWalletPublicOutput = Pick<UserWalletOutput, "id" | "userId" | "address" | "creditAmount" | "isTrialing">;

@singleton()
export class UserWalletRepository extends BaseRepository<ApiPgTables["UserWallets"], UserWalletInput, UserWalletOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("UserWallets") protected readonly table: ApiPgTables["UserWallets"],
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "UserWallet", "UserWallets");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserWalletRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async create(input: Pick<UserWalletInput, "userId" | "address">) {
    const value = {
      userId: input.userId,
      address: input.address
    };

    this.ability?.throwUnlessCanExecute(value);
    const [item] = await this.cursor.insert(this.table).values(value).returning();

    return this.toOutput(item);
  }

  async findDrainingWallets(thresholds = { fee: 0 }) {
    const where = and(lte(this.table.feeAllowance, thresholds.fee.toString()), eq(this.table.isTrialing, false));

    return this.toOutputList(
      await this.cursor.query.UserWallets.findMany({
        where: this.whereAccessibleBy(where)
      })
    );
  }

  async findOneByUserId(userId: UserWalletOutput["userId"]) {
    if (!userId) return undefined;

    const userWallet = await this.cursor.query.UserWallets.findFirst({ where: this.whereAccessibleBy(eq(this.table.userId, userId)) });
    if (!userWallet) return undefined;

    return this.toOutput(userWallet);
  }

  async findByUserId(userId: UserWalletOutput["userId"] | UserWalletOutput["userId"][]) {
    const where = Array.isArray(userId) ? inArray(this.table.userId, userId as string[]) : eq(this.table.userId, userId as string);
    return this.toOutputList(await this.cursor.query.UserWallets.findMany({ where: this.whereAccessibleBy(where) }));
  }

  async payingUserCount() {
    const [{ count: payingUserCount }] = await this.cursor.select({ count: count() }).from(this.table).where(eq(this.table.isTrialing, false));
    return payingUserCount;
  }

  protected toOutput(dbOutput: DbUserWalletOutput): UserWalletOutput {
    const deploymentAllowance = dbOutput?.deploymentAllowance && parseFloat(dbOutput.deploymentAllowance);

    return {
      ...dbOutput,
      creditAmount: deploymentAllowance || 0,
      deploymentAllowance: deploymentAllowance || 0,
      feeAllowance: parseFloat(dbOutput.feeAllowance)
    };
  }

  protected toInput({ deploymentAllowance, feeAllowance, ...input }: UserWalletInput): DbUserWalletInput {
    const dbInput: DbUserWalletInput = input;

    if (deploymentAllowance !== undefined) {
      dbInput.deploymentAllowance = deploymentAllowance.toString();
    }

    if (feeAllowance !== undefined) {
      dbInput.feeAllowance = feeAllowance.toString();
    }

    return dbInput;
  }

  toPublic(output: UserWalletOutput): UserWalletPublicOutput {
    return pick(output, ["id", "userId", "address", "creditAmount", "isTrialing"]);
  }
}
