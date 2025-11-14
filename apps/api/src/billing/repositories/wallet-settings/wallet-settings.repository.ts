import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["WalletSetting"];
type DbWalletSettingInput = ApiPgTables["WalletSetting"]["$inferInsert"];
type DbWalletSettingOutput = ApiPgTables["WalletSetting"]["$inferSelect"];

export type WalletSettingInput = Partial<
  Omit<DbWalletSettingInput, "autoReloadThreshold" | "autoReloadAmount"> & {
    autoReloadThreshold: number;
    autoReloadAmount: number;
  }
>;

export type WalletSettingOutput = Omit<DbWalletSettingOutput, "autoReloadThreshold" | "autoReloadAmount"> & {
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
};

@singleton()
export class WalletSettingRepository extends BaseRepository<Table, WalletSettingInput, WalletSettingOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("WalletSetting") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "WalletSetting", "WalletSetting");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new WalletSettingRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByUserId(userId: WalletSettingOutput["userId"]) {
    const walletSetting = await this.cursor.query.WalletSetting.findFirst({
      where: this.whereAccessibleBy(eq(this.table.userId, userId))
    });
    if (!walletSetting) return undefined;
    return this.toOutput(walletSetting);
  }

  protected toOutput(dbOutput: Partial<DbWalletSettingOutput>): WalletSettingOutput {
    const output = dbOutput as DbWalletSettingOutput;
    return {
      ...output,
      autoReloadThreshold: output.autoReloadThreshold === null ? undefined : parseFloat(output.autoReloadThreshold),
      autoReloadAmount: output.autoReloadAmount === null ? undefined : parseFloat(output.autoReloadAmount)
    } as WalletSettingOutput;
  }

  protected toInput(payload: Partial<WalletSettingInput>): Partial<DbWalletSettingInput> {
    const { autoReloadThreshold, autoReloadAmount, ...input } = payload;
    const dbInput: Partial<DbWalletSettingInput> = input as Partial<DbWalletSettingInput>;

    if (autoReloadThreshold !== undefined) {
      dbInput.autoReloadThreshold = autoReloadThreshold.toString();
    }

    if (autoReloadAmount !== undefined) {
      dbInput.autoReloadAmount = autoReloadAmount.toString();
    }

    return dbInput;
  }
}
