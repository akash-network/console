import { eq, lte } from "drizzle-orm";
import first from "lodash/first";
import omit from "lodash/omit";
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

    return this.toOutput(first(await this.cursor.insert(this.table).values(value).returning()));
  }

  async findDrainingWallets(thresholds = { fee: 0 }) {
    const where = lte(this.table.feeAllowance, thresholds.fee.toString());

    return this.toOutputList(
      await this.cursor.query.UserWallets.findMany({
        where: this.whereAccessibleBy(where)
      })
    );
  }

  async findByUserId(userId: UserWalletOutput["userId"]) {
    return this.toOutput(await this.cursor.query.UserWallets.findFirst({ where: this.whereAccessibleBy(eq(this.table.userId, userId)) }));
  }

  protected toOutput(dbOutput: DbUserWalletOutput): UserWalletOutput {
    const deploymentAllowance = parseFloat(dbOutput.deploymentAllowance);
    return {
      ...omit(dbOutput, ["feeAllowance", "deploymentAllowance"]),
      creditAmount: deploymentAllowance,
      deploymentAllowance,
      feeAllowance: parseFloat(dbOutput.feeAllowance)
    };
  }

  protected toInput({ deploymentAllowance, feeAllowance, ...input }: UserWalletInput): DbUserWalletInput {
    const dbInput: DbUserWalletInput = input;

    if (deploymentAllowance) {
      dbInput.deploymentAllowance = deploymentAllowance.toString();
    }

    if (feeAllowance) {
      dbInput.feeAllowance = feeAllowance.toString();
    }

    return dbInput;
  }

  toPublic(output: UserWalletOutput): UserWalletPublicOutput {
    return pick(output, ["id", "userId", "address", "creditAmount", "isTrialing"]);
  }
}
