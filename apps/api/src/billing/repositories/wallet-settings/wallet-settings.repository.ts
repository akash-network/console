import { and, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["WalletSetting"];
type DbWalletSettingInput = ApiPgTables["WalletSetting"]["$inferInsert"];
type DbWalletSettingOutput = ApiPgTables["WalletSetting"]["$inferSelect"];

export type WalletSettingInput = Partial<DbWalletSettingInput>;

export type WalletSettingOutput = DbWalletSettingOutput;

/**
 * A won claim carries the marker it wrote so a later decline write can be scoped to the exact charge
 * attempt it describes. The marker is text rather than a Date because `last_auto_charge_at` is a
 * timestamp without time zone, which the driver would shift by its local offset.
 */
export type ChargeClaim = { id: string; claimedAt: string };

/**
 * A lost claim carries how long is left on the cooldown that blocked it, so the caller defers only
 * for the remainder instead of a whole fresh cooldown. Postgres computes it for the same reason the
 * marker comes back as text. Zero means the window is already open again.
 */
export type ChargeClaimAttempt = { won: true; claim: ChargeClaim } | { won: false; secondsUntilWindowReopen: number };

/** Reports the count after the decline, and the pause instant when this call is the one that flipped the wallet to paused. */
export type ChargeDeclineOutcome = { failureCount: number; pausedAt: Date | null };

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
   * Atomically claims the right to auto-charge a wallet, rate-limiting auto-reload charges in both
   * modes. A wallet is claimable when it has never been auto-charged or its last charge is older
   * than the cooldown; concurrent callers resolve to a single winner via the row-lock re-check. A
   * cooldown of 0 always claims, disabling the cap. A claim is never released — a failed charge
   * consumes the window too — so a lost claim reads back the cooldown still owed, letting the
   * caller wait out only what is left rather than a whole fresh one.
   */
  async claimForCharge(id: WalletSettingOutput["id"], cooldownMinutes: number): Promise<ChargeClaimAttempt> {
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

    if (claim) {
      return { won: true, claim };
    }

    const [blocking] = await this.cursor
      .select({
        secondsUntilWindowReopen: sql<string>`greatest(extract(epoch from (${this.table.lastAutoChargeAt} + (${cooldownMinutes} * interval '1 minute') - now())), 0)`
      })
      .from(this.table)
      .where(eq(this.table.id, id));

    return { won: false, secondsUntilWindowReopen: Number(blocking?.secondsUntilWindowReopen ?? 0) };
  }

  /**
   * Counts one declined charge and pauses the wallet once the card has run out of chances. Scoping
   * the write to the marker its claim wrote discards a decline that lands after the user has already
   * replaced the card, since that clears the marker. The pause is guarded on being unset, so a
   * returned `pausedAt` is a real transition and only one caller ever sends the email.
   */
  async recordChargeDecline(claim: ChargeClaim, options: { maxConsecutiveDeclines: number; isTerminal: boolean }): Promise<ChargeDeclineOutcome> {
    const [declined] = await this.cursor
      .update(this.table)
      .set({ autoReloadFailureCount: sql`${this.table.autoReloadFailureCount} + 1`, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, claim.id), eq(this.table.lastAutoChargeAt, sql`${claim.claimedAt}::timestamp`)))
      .returning({ failureCount: this.table.autoReloadFailureCount });

    if (!declined) {
      return { failureCount: 0, pausedAt: null };
    }

    const hasChancesLeft = !options.isTerminal && declined.failureCount < options.maxConsecutiveDeclines;

    return {
      failureCount: declined.failureCount,
      pausedAt: hasChancesLeft ? null : await this.#pauseAutoReload(claim.id)
    };
  }

  async #pauseAutoReload(id: WalletSettingOutput["id"]): Promise<Date | null> {
    const [paused] = await this.cursor
      .update(this.table)
      .set({ autoReloadPausedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), isNull(this.table.autoReloadPausedAt)))
      .returning({ pausedAt: this.table.autoReloadPausedAt });

    return paused?.pausedAt ?? null;
  }

  /** Puts a wallet back to a clean slate after a charge went through, leaving an already-clean row untouched. */
  async resetChargeFailures(id: WalletSettingOutput["id"]): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ autoReloadFailureCount: 0, autoReloadPausedAt: null, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, id), or(ne(this.table.autoReloadFailureCount, 0), isNotNull(this.table.autoReloadPausedAt))));
  }

  /**
   * Lifts a pause after a payment method change. Clearing the charge marker too is what lets the
   * next check charge straight away instead of waiting out the cooldown the dead card consumed.
   */
  async clearChargeState(id: WalletSettingOutput["id"]): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ autoReloadFailureCount: 0, autoReloadPausedAt: null, lastAutoChargeAt: null, updatedAt: sql`now()` })
      .where(eq(this.table.id, id));
  }
}
