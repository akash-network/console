import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import type { ChargeClaimAttempt } from "./wallet-settings.repository";
import { WalletSettingRepository } from "./wallet-settings.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const COOLDOWN_MINUTES = 60;
const NO_COOLDOWN = 0;

/** Narrows an attempt the assertions have already established was rate limited. */
function reopenSecondsOf(attempt: ChargeClaimAttempt) {
  return (attempt as Extract<ChargeClaimAttempt, { won: false }>).secondsUntilWindowReopen;
}

describe(WalletSettingRepository.name, () => {
  describe("claimForCharge", () => {
    it("awards a claim to exactly one caller across concurrent attempts", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const results = await Promise.all(Array.from({ length: 5 }, () => walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES)));

      expect(results.filter(result => result.won)).toHaveLength(1);
    });

    it("does not re-claim a wallet charged within the cooldown", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const first = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      const second = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);

      expect(first).toEqual({ won: true, claim: { id: settingId, claimedAt: expect.any(String) } });
      expect(second).toEqual({ won: false, secondsUntilWindowReopen: expect.any(Number) });
    });

    it("reports only the cooldown still owed, not a whole fresh one", async () => {
      const { walletSettingRepository, settingId, backdateLastAutoChargeAt } = await setup();
      const minutesElapsed = 59;

      await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      await backdateLastAutoChargeAt(settingId, minutesElapsed);
      const blocked = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);

      expect(blocked.won).toBe(false);
      expect(reopenSecondsOf(blocked)).toBeCloseTo((COOLDOWN_MINUTES - minutesElapsed) * 60, -1);
    });

    it("measures the cooldown still owed against the cooldown it was asked for", async () => {
      const { walletSettingRepository, settingId, backdateLastAutoChargeAt } = await setup();

      await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      await backdateLastAutoChargeAt(settingId, COOLDOWN_MINUTES + 5);
      const blocked = await walletSettingRepository.claimForCharge(settingId, 2 * COOLDOWN_MINUTES);

      expect(blocked.won).toBe(false);
      expect(reopenSecondsOf(blocked)).toBeCloseTo(55 * 60, -1);
    });

    it("claims again once the cooldown has elapsed", async () => {
      const { walletSettingRepository, settingId, backdateLastAutoChargeAt } = await setup();

      await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      await backdateLastAutoChargeAt(settingId, COOLDOWN_MINUTES + 1);
      const afterCooldown = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);

      expect(afterCooldown).toEqual({ won: true, claim: { id: settingId, claimedAt: expect.any(String) } });
    });

    it("claims consecutively when the cooldown is zero", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const first = await walletSettingRepository.claimForCharge(settingId, NO_COOLDOWN);
      const second = await walletSettingRepository.claimForCharge(settingId, NO_COOLDOWN);

      expect(first.won).toBe(true);
      expect(second.won).toBe(true);
    });
  });

  describe("recordChargeDecline", () => {
    it("counts one decline per charge attempt", async () => {
      const { walletSettingRepository, claim, readSetting } = await setup();

      const outcome = await walletSettingRepository.recordChargeDecline(await claim(), { maxConsecutiveDeclines: 4, isTerminal: false });

      expect(outcome).toEqual({ failureCount: 1, pausedAt: null });
      expect((await readSetting()).autoReloadPausedAt).toBeNull();
    });

    it("pauses the wallet once the card has run out of chances", async () => {
      const { walletSettingRepository, settingId, claim, backdateLastAutoChargeAt } = await setup();

      const outcomes = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        outcomes.push(await walletSettingRepository.recordChargeDecline(await claim(), { maxConsecutiveDeclines: 3, isTerminal: false }));
        await backdateLastAutoChargeAt(settingId, COOLDOWN_MINUTES + 1);
      }

      expect(outcomes.map(outcome => outcome.failureCount)).toEqual([1, 2, 3]);
      expect(outcomes.slice(0, 2).map(outcome => outcome.pausedAt)).toEqual([null, null]);
      expect(outcomes[2].pausedAt).toBeInstanceOf(Date);
    });

    it("pauses a lost or stolen card on its first decline", async () => {
      const { walletSettingRepository, claim } = await setup();

      const outcome = await walletSettingRepository.recordChargeDecline(await claim(), { maxConsecutiveDeclines: 4, isTerminal: true });

      expect(outcome.failureCount).toBe(1);
      expect(outcome.pausedAt).toBeInstanceOf(Date);
    });

    it("reports the pause to exactly one of the callers racing to record it", async () => {
      const { walletSettingRepository, claim } = await setup();
      const won = await claim();

      const outcomes = await Promise.all(
        Array.from({ length: 5 }, () => walletSettingRepository.recordChargeDecline(won, { maxConsecutiveDeclines: 1, isTerminal: false }))
      );

      expect(outcomes.filter(outcome => outcome.pausedAt)).toHaveLength(1);
    });

    it("discards a decline whose charge window has already been cleared", async () => {
      const { walletSettingRepository, settingId, claim, readSetting } = await setup();
      const won = await claim();
      await walletSettingRepository.clearChargeState(settingId);

      const outcome = await walletSettingRepository.recordChargeDecline(won, { maxConsecutiveDeclines: 4, isTerminal: true });

      expect(outcome).toEqual({ failureCount: 0, pausedAt: null });
      expect((await readSetting()).autoReloadPausedAt).toBeNull();
    });
  });

  describe("resetChargeFailures", () => {
    it("puts a wallet with declines behind it back to a clean slate", async () => {
      const { walletSettingRepository, settingId, claim, readSetting } = await setup();
      await walletSettingRepository.recordChargeDecline(await claim(), { maxConsecutiveDeclines: 4, isTerminal: true });

      await walletSettingRepository.resetChargeFailures(settingId);

      const setting = await readSetting();
      expect(setting.autoReloadFailureCount).toBe(0);
      expect(setting.autoReloadPausedAt).toBeNull();
    });

    it("keeps the charge marker so the cooldown still applies", async () => {
      const { walletSettingRepository, settingId, claim, readSetting } = await setup();
      await claim();

      await walletSettingRepository.resetChargeFailures(settingId);

      expect((await readSetting()).lastAutoChargeAt).not.toBeNull();
    });
  });

  describe("clearChargeState", () => {
    it("lifts the pause and reopens the charge window at once", async () => {
      const { walletSettingRepository, settingId, claim, readSetting } = await setup();
      await walletSettingRepository.recordChargeDecline(await claim(), { maxConsecutiveDeclines: 4, isTerminal: true });

      await walletSettingRepository.clearChargeState(settingId);

      const setting = await readSetting();
      expect(setting.autoReloadFailureCount).toBe(0);
      expect(setting.autoReloadPausedAt).toBeNull();
      expect(setting.lastAutoChargeAt).toBeNull();
    });
  });

  async function setup() {
    const userRepository = container.resolve(UserRepository);
    const walletSettingRepository = container.resolve(WalletSettingRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const walletSettingsTable = resolveTable("WalletSetting");
    const userWalletsTable = resolveTable("UserWallets");

    const user = await userRepository.create({ userId: faker.string.uuid() });
    const [wallet] = await db
      .insert(userWalletsTable)
      .values({ userId: user.id, address: createAkashAddress(), deploymentAllowance: "10000000", feeAllowance: "5000000" })
      .returning({ id: userWalletsTable.id });
    const setting = await walletSettingRepository.create({ userId: user.id, walletId: wallet.id });

    async function backdateLastAutoChargeAt(id: string, minutesAgo: number) {
      await db
        .update(walletSettingsTable)
        .set({ lastAutoChargeAt: sql`now() - (${minutesAgo} * interval '1 minute')` })
        .where(eq(walletSettingsTable.id, id));
    }

    async function claim() {
      const attempt = await walletSettingRepository.claimForCharge(setting.id, COOLDOWN_MINUTES);
      return (attempt as Extract<ChargeClaimAttempt, { won: true }>).claim;
    }

    async function readSetting() {
      const [row] = await db.select().from(walletSettingsTable).where(eq(walletSettingsTable.id, setting.id));
      return row;
    }

    return {
      walletSettingRepository,
      settingId: setting.id,
      backdateLastAutoChargeAt,
      claim,
      readSetting
    };
  }
});
