import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { DeploymentSettingRepository } from "./deployment-setting.repository";

const COOLDOWN_MINUTES = 60;

describe(DeploymentSettingRepository.name, () => {
  describe("claimForFunding", () => {
    it("awards a claim to exactly one caller across concurrent attempts", async () => {
      const { deploymentSettingRepository, settingId } = await setup();

      const results = await Promise.all(Array.from({ length: 5 }, () => deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES)));

      const winners = results.filter(claims => claims.some(claim => claim.id === settingId));
      expect(winners).toHaveLength(1);
    });

    it("does not re-claim a deployment funded within the cooldown", async () => {
      const { deploymentSettingRepository, settingId } = await setup();

      const first = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);
      const second = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);

      expect(first).toEqual([{ id: settingId, claimedAt: expect.any(String) }]);
      expect(second).toEqual([]);
    });

    it("claims again once the cooldown has elapsed", async () => {
      const { deploymentSettingRepository, settingId, backdateLastFundedAt } = await setup();

      await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);
      await backdateLastFundedAt(settingId, COOLDOWN_MINUTES + 1);
      const afterCooldown = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);

      expect(afterCooldown).toEqual([{ id: settingId, claimedAt: expect.any(String) }]);
    });

    it("returns only the ids still outside the cooldown when a batch mixes fresh and recently funded", async () => {
      const { deploymentSettingRepository, settingId, createSetting } = await setup();
      const freshId = await createSetting();

      await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);
      const claimed = await deploymentSettingRepository.claimForFunding([settingId, freshId], COOLDOWN_MINUTES);

      expect(claimed).toEqual([{ id: freshId, claimedAt: expect.any(String) }]);
    });
  });

  describe("releaseFundingClaim", () => {
    it("makes a claimed deployment immediately claimable again", async () => {
      const { deploymentSettingRepository, settingId } = await setup();

      const claims = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);
      await deploymentSettingRepository.releaseFundingClaim(claims);
      const afterRelease = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);

      expect(afterRelease).toEqual([{ id: settingId, claimedAt: expect.any(String) }]);
    });

    it("leaves a newer claim in place when the caller whose claim aged out releases late", async () => {
      const { deploymentSettingRepository, settingId } = await setup();
      const NO_COOLDOWN = 0;

      const agedOutClaim = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);
      const newerClaim = await deploymentSettingRepository.claimForFunding([settingId], NO_COOLDOWN);
      await deploymentSettingRepository.releaseFundingClaim(agedOutClaim);

      expect(newerClaim).toHaveLength(1);
      expect(await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES)).toEqual([]);

      await deploymentSettingRepository.releaseFundingClaim(newerClaim);

      expect(await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES)).toEqual([{ id: settingId, claimedAt: expect.any(String) }]);
    });
  });

  describe("applyRuntimeLimit", () => {
    it("raises the limit for the row's own user", async () => {
      const { deploymentSettingRepository, user, abilityFor, createLimitedSetting } = await setup();
      const setting = await createLimitedSetting(12);

      const updated = await deploymentSettingRepository
        .accessibleBy(abilityFor(user), "update")
        .applyRuntimeLimit({ userId: user.id, dseq: setting.dseq, runtimeLimitHours: 24, maxIncrementHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS });

      expect(updated).toEqual(expect.objectContaining({ runtimeLimitHours: 24 }));
    });

    it("leaves the row untouched for a caller whose ability does not cover its user", async () => {
      const { deploymentSettingRepository, user, userRepository, abilityFor, createLimitedSetting } = await setup();
      const setting = await createLimitedSetting(12);
      const otherUser = await userRepository.create({ userId: faker.string.uuid() });

      const updated = await deploymentSettingRepository
        .accessibleBy(abilityFor(otherUser), "update")
        .applyRuntimeLimit({ userId: user.id, dseq: setting.dseq, runtimeLimitHours: 24, maxIncrementHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS });

      expect(updated).toBeUndefined();
      expect(await deploymentSettingRepository.findById(setting.id)).toEqual(expect.objectContaining({ runtimeLimitHours: 12 }));
    });
  });

  async function setup() {
    const userRepository = container.resolve(UserRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const abilityService = container.resolve(AbilityService);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const user = await userRepository.create({ userId: faker.string.uuid() });

    function abilityFor(owner: UserOutput) {
      return abilityService.getAbilityFor("REGULAR_USER", owner);
    }

    async function createSetting() {
      const setting = await deploymentSettingRepository.create({
        userId: user.id,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        autoTopUpEnabled: true
      });
      return setting.id;
    }

    async function createLimitedSetting(runtimeLimitHours: number) {
      return deploymentSettingRepository.create({
        userId: user.id,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        autoTopUpEnabled: true,
        runtimeLimitHours
      });
    }

    async function backdateLastFundedAt(id: string, minutesAgo: number) {
      await db
        .update(deploymentSettingsTable)
        .set({ lastFundedAt: sql`now() - (${minutesAgo} * interval '1 minute')` })
        .where(eq(deploymentSettingsTable.id, id));
    }

    const settingId = await createSetting();

    return { userRepository, deploymentSettingRepository, user, settingId, abilityFor, createSetting, createLimitedSetting, backdateLastFundedAt };
  }
});
