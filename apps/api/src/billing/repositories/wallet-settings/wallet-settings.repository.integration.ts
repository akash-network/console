import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { WalletSettingRepository } from "./wallet-settings.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const COOLDOWN_MINUTES = 60;
const NO_COOLDOWN = 0;

describe(WalletSettingRepository.name, () => {
  describe("claimForCharge", () => {
    it("awards a claim to exactly one caller across concurrent attempts", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const results = await Promise.all(Array.from({ length: 5 }, () => walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES)));

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("does not re-claim a wallet charged within the cooldown", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const first = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      const second = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);

      expect(first).toEqual({ id: settingId, claimedAt: expect.any(String) });
      expect(second).toBeUndefined();
    });

    it("claims again once the cooldown has elapsed", async () => {
      const { walletSettingRepository, settingId, backdateLastAutoChargeAt } = await setup();

      await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      await backdateLastAutoChargeAt(settingId, COOLDOWN_MINUTES + 1);
      const afterCooldown = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);

      expect(afterCooldown).toEqual({ id: settingId, claimedAt: expect.any(String) });
    });

    it("claims consecutively when the cooldown is zero", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const first = await walletSettingRepository.claimForCharge(settingId, NO_COOLDOWN);
      const second = await walletSettingRepository.claimForCharge(settingId, NO_COOLDOWN);

      expect(first).toEqual({ id: settingId, claimedAt: expect.any(String) });
      expect(second).toEqual({ id: settingId, claimedAt: expect.any(String) });
    });
  });

  describe("releaseChargeClaim", () => {
    it("makes a claimed wallet immediately claimable again", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const claim = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      await walletSettingRepository.releaseChargeClaim(claim!);
      const afterRelease = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);

      expect(afterRelease).toEqual({ id: settingId, claimedAt: expect.any(String) });
    });

    it("leaves a newer claim in place when the caller whose claim aged out releases late", async () => {
      const { walletSettingRepository, settingId } = await setup();

      const agedOutClaim = await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES);
      const newerClaim = await walletSettingRepository.claimForCharge(settingId, NO_COOLDOWN);
      await walletSettingRepository.releaseChargeClaim(agedOutClaim!);

      expect(newerClaim).toBeDefined();
      expect(await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES)).toBeUndefined();

      await walletSettingRepository.releaseChargeClaim(newerClaim!);

      expect(await walletSettingRepository.claimForCharge(settingId, COOLDOWN_MINUTES)).toEqual({ id: settingId, claimedAt: expect.any(String) });
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

    return {
      walletSettingRepository,
      settingId: setting.id,
      backdateLastAutoChargeAt
    };
  }
});
