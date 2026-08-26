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

  describe("findUnbackedDefinitionCandidates", () => {
    it("returns one page of the newest candidates, not the oldest and not all of them", async () => {
      const { deploymentSettingRepository, rememberDefinitions } = await setup();
      const dseqs = await rememberDefinitions(["oldest", "older", "middle", "newer", "newest"]);

      const page = await deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours: 1, pageSize: 3 });

      expect(page.map(candidate => candidate.dseq)).toEqual([dseqs.newest, dseqs.newer, dseqs.middle]);
    });

    it("walks the rest through the cursor, returning each record exactly once", async () => {
      const { deploymentSettingRepository, rememberDefinitions } = await setup();
      const dseqs = await rememberDefinitions(["oldest", "older", "middle", "newer", "newest"]);

      const first = await deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours: 1, pageSize: 3 });
      const second = await deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours: 1, pageSize: 3, olderThan: first[2] });

      expect(second.map(candidate => candidate.dseq)).toEqual([dseqs.older, dseqs.oldest]);
    });

    /**
     * `created_at` is `now()` at microsecond precision and a JS `Date` holds milliseconds, so a cursor
     * carried as a `Date` is the real value truncated down — and the next page, asking for rows strictly
     * older than it, silently drops every sibling written in the same millisecond. Ties on an identical
     * timestamp are the other half: they are what the `id` tiebreaker and the secondary ORDER BY exist for.
     * Both are seeded here, and both straddle a page boundary.
     *
     * The tie group is deliberately wider than a page. Postgres promises no order among rows with equal sort
     * keys, so a fixture whose ties fit inside one page could agree with an id-ordered walk by luck and pass
     * against a broken ORDER BY. Four tied rows against a page size of two put a boundary inside the group,
     * which is what makes the walk desynchronise whenever the ordering is not id-descending. Resize one and
     * you have to resize the other.
     */
    it("returns every record exactly once when timestamps collide or differ only in microseconds", async () => {
      const { rememberDefinitionsAt, walkEveryPage } = await setup();
      const seeded = await rememberDefinitionsAt([
        "2026-01-01 00:00:00.700000",
        "2026-01-01 00:00:00.500000",
        "2026-01-01 00:00:00.500000",
        "2026-01-01 00:00:00.500000",
        "2026-01-01 00:00:00.500000",
        "2026-01-01 00:00:00.123400",
        "2026-01-01 00:00:00.123200",
        "2026-01-01 00:00:00.123000"
      ]);

      const walked = await walkEveryPage(2);

      expect([...walked].sort()).toEqual([...seeded].sort());
    });

    it("returns no page at all once the cursor passes the oldest candidate", async () => {
      const { deploymentSettingRepository, rememberDefinitions } = await setup();
      await rememberDefinitions(["oldest", "newest"]);

      const first = await deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours: 1, pageSize: 10 });
      const exhausted = await deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours: 1, pageSize: 10, olderThan: first[1] });

      expect(first).toHaveLength(2);
      expect(exhausted).toEqual([]);
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

    it("excludes a deadline that has already passed, leaving it to the closer", async () => {
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

    async function createAnchoredSetting(input: { runtimeLimitHours: number; endsInHours: number; closed?: boolean; userId?: string }) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId: input.userId ?? user.id,
          dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
          autoTopUpEnabled: true,
          closed: input.closed ?? false,
          runtimeLimitHours: input.runtimeLimitHours,
          runtimeEndsAt: new Date(Date.now() + hoursToMilliseconds(input.endsInHours))
        })
        .returning();

      return setting;
    }

    /**
     * Remembered definitions at exact timestamps, written as text so the microseconds survive: a JS `Date`
     * is millisecond-only and could not express the collisions these tests exist to cover. Returns the
     * dseqs in seeding order.
     */
    async function rememberDefinitionsAt(timestamps: string[]) {
      await db.delete(deploymentSettingsTable);

      const dseqs: string[] = [];

      for (const [index, timestamp] of timestamps.entries()) {
        const dseq = `9100${index}`;
        dseqs.push(dseq);
        await db.insert(deploymentSettingsTable).values({
          userId: user.id,
          dseq,
          autoTopUpEnabled: true,
          closed: false,
          sdl: "version: '2.0'",
          manifestVersion: "bWFuaWZlc3Q=",
          createdAt: sql`${timestamp}::timestamp` as unknown as Date
        });
      }

      return dseqs;
    }

    /** Pages to exhaustion exactly as the sweep does, so a cursor that skips or repeats a row shows up here. */
    async function walkEveryPage(pageSize: number) {
      const seen: string[] = [];
      let olderThan;

      while (true) {
        const page = await deploymentSettingRepository.findUnbackedDefinitionCandidates({ graceHours: 1, pageSize, olderThan });

        if (!page.length) {
          break;
        }

        seen.push(...page.map(candidate => candidate.dseq));
        olderThan = page[page.length - 1];

        if (page.length < pageSize) {
          break;
        }
      }

      return seen;
    }

    /**
     * Remembered definitions written one hour apart, oldest label first, all well past any grace period.
     * Distinct `created_at` values are the point: they are what makes newest-first observable.
     */
    async function rememberDefinitions(labels: string[]) {
      await db.delete(deploymentSettingsTable);

      const byLabel: Record<string, string> = {};

      for (const [index, label] of labels.entries()) {
        const dseq = `9000${index}`;
        byLabel[label] = dseq;
        await db.insert(deploymentSettingsTable).values({
          userId: user.id,
          dseq,
          autoTopUpEnabled: true,
          closed: false,
          sdl: "version: '2.0'",
          manifestVersion: "bWFuaWZlc3Q=",
          createdAt: new Date(Date.now() - hoursToMilliseconds(labels.length - index + 1))
        });
      }

      return byLabel;
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
      rememberDefinitions,
      rememberDefinitionsAt,
      walkEveryPage,
      backdateLastFundedAt
    };
  }
});
