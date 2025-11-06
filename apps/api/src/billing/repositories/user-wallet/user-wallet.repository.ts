import subDays from "date-fns/subDays";
import { and, count, eq, gt, inArray, lte, or } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
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

export interface UserWalletPublicOutput {
  id: UserWalletOutput["id"];
  userId: UserWalletOutput["userId"];
  address: UserWalletOutput["address"];
  creditAmount: UserWalletOutput["creditAmount"];
  isTrialing: boolean;
}

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

  async getOrCreate(input: { userId: Exclude<UserWalletInput["userId"], undefined | null> }): Promise<{ wallet: UserWalletOutput; isNew: boolean }> {
    const foundWallet = await this.findOneByUserId(input.userId);
    if (foundWallet) return { wallet: foundWallet, isNew: false };

    this.ability?.throwUnlessCanExecute(input);
    const [newWallet] = await this.cursor
      .insert(this.table)
      .values(input)
      .onConflictDoNothing({
        target: [this.table.userId]
      })
      .returning();

    if (newWallet) {
      return {
        wallet: this.toOutput(newWallet),
        isNew: true
      };
    }

    // race condition, wallet was created by another call
    const wallet = await this.findOneByUserId(input.userId);
    return { wallet: wallet!, isNew: false };
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

  async findDrainingWallets(thresholds: { fee: number; trialExpirationDays: number }) {
    const trialWindowStart = subDays(new Date(), thresholds.trialExpirationDays);

    return this.toOutputList(
      await this.cursor.query.UserWallets.findMany({
        where: this.whereAccessibleBy(
          and(
            lte(this.table.feeAllowance, thresholds.fee.toString()),
            or(and(eq(this.table.isTrialing, true), gt(this.table.createdAt, trialWindowStart)), eq(this.table.isTrialing, false))
          )
        )
      })
    );
  }

  async findOneByUserId(userId: UserWalletOutput["userId"]) {
    if (!userId) return undefined;

    const userWallet = await this.cursor.query.UserWallets.findFirst({ where: this.whereAccessibleBy(eq(this.table.userId, userId)) });
    if (!userWallet) return undefined;

    return this.toOutput(userWallet);
  }

  async findFirst() {
    return this.findOneBy();
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
    return {
      id: output.id,
      userId: output.userId,
      address: output.address,
      creditAmount: output.creditAmount,
      isTrialing: !!output.isTrialing
    };
  }
}
