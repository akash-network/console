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

  async findByUserId(userId: WalletSettingOutput["userId"]): Promise<WalletSettingOutput | undefined> {
    const walletSetting = await this.cursor.query.WalletSetting.findFirst({
      where: this.whereAccessibleBy(eq(this.table.userId, userId))
    });

    if (!walletSetting) return undefined;

    return this.toOutput(walletSetting);
  }

  async findInternalByUserIdWithRelations(userId: WalletSettingOutput["userId"]) {
    const walletSetting = await this.cursor.query.WalletSetting.findFirst({
      where: this.whereAccessibleBy(eq(this.table.userId, userId)),
      with: {
        wallet: {
          columns: {
            address: true
          }
        },
        user: true
      }
    });

    if (!walletSetting) return undefined;

    return walletSetting;
  }
}
