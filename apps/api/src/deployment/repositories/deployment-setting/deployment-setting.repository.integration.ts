import { faker } from "@faker-js/faker";
import { hoursToMilliseconds } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { DeploymentSettingRepository } from "./deployment-setting.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const COOLDOWN_MINUTES = 60;
const OUTAGE_STARTED_AT = "2026-08-01T00:00:00.000Z";
const LATER_OUTAGE_STARTED_AT = "2026-08-20T00:00:00.000Z";
const WARNING_WINDOW = { leadHours: 6, minLimitHours: 12 };

/** Rows created with a `Date` store exactly that value, so its ISO form is the marker the claim matches on. */
function markerFor(runtimeEndsAt: Date) {
  return runtimeEndsAt.toISOString();
}

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

    it("turns auto top-up on so the raised limit can be funded and anchored", async () => {
      const { deploymentSettingRepository, user, abilityFor, createLimitedSetting } = await setup();
      const setting = await createLimitedSetting(12, { autoTopUpEnabled: false });

      const updated = await deploymentSettingRepository
        .accessibleBy(abilityFor(user), "update")
        .applyRuntimeLimit({ userId: user.id, dseq: setting.dseq, runtimeLimitHours: 24, maxIncrementHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS });

      expect(updated).toEqual(expect.objectContaining({ runtimeLimitHours: 24, autoTopUpEnabled: true }));
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

  describe("create", () => {
    it("enables auto top-up on a row whose owner expressed no preference", async () => {
      const { deploymentSettingRepository, user } = await setup();

      const setting = await deploymentSettingRepository.create({ userId: user.id, dseq: faker.number.int({ min: 100000, max: 999999 }).toString() });

      expect(setting.autoTopUpEnabled).toBe(true);
    });

    it("keeps an explicit opt-out rather than overwriting it with the default", async () => {
      const { deploymentSettingRepository, user } = await setup();

      const setting = await deploymentSettingRepository.create({
        userId: user.id,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        autoTopUpEnabled: false
      });

      expect(setting.autoTopUpEnabled).toBe(false);
    });
  });

  describe("findExpiredRuntimeDeployments", () => {
    it("returns a deployment whose deadline has passed, with what a close job needs", async () => {
      const { deploymentSettingRepository, createAnchoredSetting, user } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: -1 });

      const expired = await deploymentSettingRepository.findExpiredRuntimeDeployments();

      expect(expired).toContainEqual(expect.objectContaining({ id: setting.id, userId: user.id, dseq: setting.dseq }));
    });

    it("excludes a deadline still ahead", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 1 });

      const expired = await deploymentSettingRepository.findExpiredRuntimeDeployments();

      expect(expired.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a runtime limit that was never anchored", async () => {
      const { deploymentSettingRepository, createLimitedSetting } = await setup();
      const setting = await createLimitedSetting(24);

      const expired = await deploymentSettingRepository.findExpiredRuntimeDeployments();

      expect(expired.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a deployment already marked closed", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: -1, closed: true });

      const expired = await deploymentSettingRepository.findExpiredRuntimeDeployments();

      expect(expired.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("returns an expired deployment whose auto top-up was turned off", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: -1, autoTopUpEnabled: false });

      const expired = await deploymentSettingRepository.findExpiredRuntimeDeployments();

      expect(expired.map(deployment => deployment.id)).toContain(setting.id);
    });
  });

  describe("findExpiringRuntimeDeployments", () => {
    it("returns a limited deployment whose deadline falls inside the lead window", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3 });

      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).toContain(setting.id);
    });

    it("excludes a deadline still beyond the lead window", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 9 });

      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a deadline that has already passed, leaving it to the close job", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: -1 });

      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a limit shorter than the minimum worth warning about", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 4, endsInHours: 3 });

      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a closed deployment", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3, closed: true });

      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a trial wallet, which already gets its own closing warning", async () => {
      const { deploymentSettingRepository, createAnchoredSetting, trialUser } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3, userId: trialUser.id });

      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("excludes a deployment already warned about this deadline", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3 });

      await deploymentSettingRepository.claimRuntimeEndingNotification(setting.id, markerFor(setting.runtimeEndsAt!));
      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments(WARNING_WINDOW);

      expect(expiring.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("warns again once an extension moves the deadline", async () => {
      const { deploymentSettingRepository, user, abilityFor, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3 });
      await deploymentSettingRepository.claimRuntimeEndingNotification(setting.id, markerFor(setting.runtimeEndsAt!));

      await deploymentSettingRepository
        .accessibleBy(abilityFor(user), "update")
        .applyRuntimeLimit({ userId: user.id, dseq: setting.dseq, runtimeLimitHours: 28, maxIncrementHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS });
      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments({ leadHours: 8, minLimitHours: 12 });

      expect(expiring.map(deployment => deployment.id)).toContain(setting.id);
    });
  });

  describe("claimRuntimeEndingNotification", () => {
    it("claims a deadline anchored by startRuntimeCountdown, whose now() carries sub-millisecond digits", async () => {
      const { deploymentSettingRepository, createLimitedSetting } = await setup();
      const created = await createLimitedSetting(24);
      await deploymentSettingRepository.startRuntimeCountdown(created.id);
      const expiring = await deploymentSettingRepository.findExpiringRuntimeDeployments({ leadHours: 25, minLimitHours: 12 });
      const anchored = expiring.find(deployment => deployment.id === created.id)!;

      const claimed = await deploymentSettingRepository.claimRuntimeEndingNotification(anchored.id, anchored.runtimeEndsAtMarker);

      expect(claimed).toBe(true);
    });

    it("awards the claim to exactly one caller across concurrent attempts", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3 });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => deploymentSettingRepository.claimRuntimeEndingNotification(setting.id, markerFor(setting.runtimeEndsAt!)))
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("refuses a claim taken against a deadline the row no longer has", async () => {
      const { deploymentSettingRepository, createAnchoredSetting } = await setup();
      const setting = await createAnchoredSetting({ runtimeLimitHours: 24, endsInHours: 3 });
      const staleDeadline = new Date(setting.runtimeEndsAt!.getTime() - hoursToMilliseconds(1));

      const claimed = await deploymentSettingRepository.claimRuntimeEndingNotification(setting.id, markerFor(staleDeadline));

      expect(claimed).toBe(false);
    });
  });

  describe("claimProviderUnreachableNotification", () => {
    it("awards the claim to exactly one caller across concurrent attempts", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const claim = { userId: user.id, dseq: newDseq(), downSinceMarker: OUTAGE_STARTED_AT };

      const results = await Promise.all(Array.from({ length: 5 }, () => deploymentSettingRepository.claimProviderUnreachableNotification(claim)));

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("refuses a second claim for the same outage", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const claim = { userId: user.id, dseq: newDseq(), downSinceMarker: OUTAGE_STARTED_AT };
      await deploymentSettingRepository.claimProviderUnreachableNotification(claim);

      const claimed = await deploymentSettingRepository.claimProviderUnreachableNotification(claim);

      expect(claimed).toBe(false);
    });

    it("claims again once the provider recovers and goes dark a second time", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.claimProviderUnreachableNotification({ userId: user.id, dseq, downSinceMarker: OUTAGE_STARTED_AT });

      const claimed = await deploymentSettingRepository.claimProviderUnreachableNotification({
        userId: user.id,
        dseq,
        downSinceMarker: LATER_OUTAGE_STARTED_AT
      });

      expect(claimed).toBe(true);
    });

    it("records the outage on a deployment that has no settings row yet, without turning funding on", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.claimProviderUnreachableNotification({ userId: user.id, dseq, downSinceMarker: OUTAGE_STARTED_AT });

      const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(setting).toMatchObject({ autoTopUpEnabled: false });
      expect(setting?.providerUnreachableNotifiedFor?.toISOString()).toBe(OUTAGE_STARTED_AT);
    });

    it("leaves the funding setting of an existing row alone", async () => {
      const { deploymentSettingRepository, user, createLimitedSetting } = await setup();
      const setting = await createLimitedSetting(24, { autoTopUpEnabled: true });

      await deploymentSettingRepository.claimProviderUnreachableNotification({
        userId: user.id,
        dseq: setting.dseq,
        downSinceMarker: OUTAGE_STARTED_AT
      });

      const updated = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: setting.dseq });
      expect(updated).toMatchObject({ autoTopUpEnabled: true });
    });
  });

  describe("releaseProviderUnreachableClaim", () => {
    it("lets the next sweep report the same outage again", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const claim = { userId: user.id, dseq: newDseq(), downSinceMarker: OUTAGE_STARTED_AT };
      await deploymentSettingRepository.claimProviderUnreachableNotification(claim);

      await deploymentSettingRepository.releaseProviderUnreachableClaim(claim);

      expect(await deploymentSettingRepository.claimProviderUnreachableNotification(claim)).toBe(true);
    });

    it("leaves a stamp written for a later outage untouched", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.claimProviderUnreachableNotification({ userId: user.id, dseq, downSinceMarker: LATER_OUTAGE_STARTED_AT });

      await deploymentSettingRepository.releaseProviderUnreachableClaim({ userId: user.id, dseq, downSinceMarker: OUTAGE_STARTED_AT });

      const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(setting?.providerUnreachableNotifiedFor?.toISOString()).toBe(LATER_OUTAGE_STARTED_AT);
    });
  });

  describe("upsertDefinition", () => {
    it("records the sdl and the manifest version of a deployment with no row yet", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({
        sdl: "version: '2.0'",
        manifestVersion: "BAUG",
        autoTopUpEnabled: true,
        runtimeLimitHours: null
      });
    });

    it("records the runtime limit its creator chose in the same write", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG", runtimeLimitHours: 6 });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: "version: '2.0'", runtimeLimitHours: 6 });
    });

    it("overwrites the definition of a row a settings read created first", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: false });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: "version: '2.0'", autoTopUpEnabled: false });
    });

    it("leaves a runtime limit already on the row alone when none is given", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 6 });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: 6 });
    });

    it("replaces a definition an earlier write recorded", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.1'", manifestVersion: "BQYH" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: "version: '2.1'", manifestVersion: "BQYH" });
    });

    it("keeps the definitions of two deployments of the same user apart", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const [first, second] = [newDseq(), newDseq()];

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: first, sdl: "first", manifestVersion: "BAUG" });
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: second, sdl: "second", manifestVersion: "BQYH" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: first })).toMatchObject({ sdl: "first", manifestVersion: "BAUG" });
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: second })).toMatchObject({ sdl: "second", manifestVersion: "BQYH" });
    });

    it("stores an sdl of the largest size the console will keep", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      const sdl = "x".repeat(SDL_MAX_LENGTH);

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl, manifestVersion: "BAUG" });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }))?.sdl).toHaveLength(SDL_MAX_LENGTH);
    });
  });

  function newDseq() {
    return faker.number.int({ min: 100000, max: 999999 }).toString();
  }

  async function setup() {
    const userRepository = container.resolve(UserRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const abilityService = container.resolve(AbilityService);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userWalletsTable = resolveTable("UserWallets");
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const trialUser = await userRepository.create({ userId: faker.string.uuid() });

    async function createWallet(userId: string, isTrialing: boolean) {
      await db.insert(userWalletsTable).values({ userId, address: createAkashAddress(), deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing });
    }

    await createWallet(user.id, false);
    await createWallet(trialUser.id, true);

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

    async function createLimitedSetting(runtimeLimitHours: number, overrides: { autoTopUpEnabled?: boolean } = {}) {
      return deploymentSettingRepository.create({
        userId: user.id,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        autoTopUpEnabled: overrides.autoTopUpEnabled ?? true,
        runtimeLimitHours
      });
    }

    async function createAnchoredSetting(input: {
      runtimeLimitHours: number;
      endsInHours: number;
      closed?: boolean;
      userId?: string;
      autoTopUpEnabled?: boolean;
    }) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId: input.userId ?? user.id,
          dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
          autoTopUpEnabled: input.autoTopUpEnabled ?? true,
          closed: input.closed ?? false,
          runtimeLimitHours: input.runtimeLimitHours,
          runtimeEndsAt: new Date(Date.now() + hoursToMilliseconds(input.endsInHours))
        })
        .returning();

      return setting;
    }

    async function backdateLastFundedAt(id: string, minutesAgo: number) {
      await db
        .update(deploymentSettingsTable)
        .set({ lastFundedAt: sql`now() - (${minutesAgo} * interval '1 minute')` })
        .where(eq(deploymentSettingsTable.id, id));
    }

    const settingId = await createSetting();

    return {
      userRepository,
      deploymentSettingRepository,
      user,
      trialUser,
      settingId,
      abilityFor,
      createSetting,
      createLimitedSetting,
      createAnchoredSetting,
      backdateLastFundedAt
    };
  }
});
