import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["WalletSetting"];
type DbWalletSettingInput = ApiPgTables["WalletSetting"]["$inferInsert"];
type DbWalletSettingOutput = ApiPgTables["WalletSetting"]["$inferSelect"];

export type WalletSettingInput = Partial<DbWalletSettingInput>;

export type WalletSettingOutput = DbWalletSettingOutput;

/** A won auto-charge claim: the wallet setting id and the exact marker the claim wrote. */
export type ChargeClaim = {
  id: string;
  claimedAt: string;
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
    return this.findOneBy({ userId });
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

  /**
   * Atomically claims the right to auto-charge a wallet, rate-limiting threshold-mode reloads. A
   * wallet is claimable when it has never been auto-charged or its last charge is older than the
   * cooldown; concurrent callers resolve to a single winner via the row-lock re-check. A cooldown
   * of 0 always claims, disabling the cap. The claim marker comes back as text to keep full
   * microsecond precision, which `releaseChargeClaim` matches on.
   */
  async claimForCharge(id: WalletSettingOutput["id"], cooldownMinutes: number): Promise<ChargeClaim | undefined> {
    const [claim] = await this.cursor
      .update(this.table)
      .set({ lastAutoChargeAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(this.table.id, id),
          or(isNull(this.table.lastAutoChargeAt), lt(this.table.lastAutoChargeAt, sql`now() - (${cooldownMinutes} * interval '1 minute')`))
        )
      )
      .returning({ id: this.table.id, claimedAt: sql<string>`${this.table.lastAutoChargeAt}::text` });

    return claim;
  }

  /**
   * Releases a charge claim so the next check can retry, used when the charge attempt failed. The
   * release is scoped to the exact marker its claim wrote, so a caller whose claim already aged out
   * of the cooldown and was re-taken by another check cannot clear that newer claim.
   */
  async releaseChargeClaim(claim: ChargeClaim): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ lastAutoChargeAt: null, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, claim.id), eq(this.table.lastAutoChargeAt, sql`${claim.claimedAt}::timestamp`)));
  }
}
