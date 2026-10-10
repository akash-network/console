import { ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { hoursToMilliseconds } from "date-fns";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { DeploymentSettingRepository } from "./deployment-setting.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { createLeaseGpuOffer } from "@test/seeders/lease-gpu-offer.seeder";
import { createLeaseGpuReading } from "@test/seeders/lease-gpu-reading.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const COOLDOWN_MINUTES = 60;
const SDL = "version: '2.0'";
const OUTAGE_STARTED_AT = "2026-08-01T00:00:00.000Z";
const LATER_OUTAGE_STARTED_AT = "2026-08-20T00:00:00.000Z";
const WARNING_WINDOW = { leadHours: 6, minLimitHours: 12 };

/** Shaped like the compact JWE the column will really carry — five base64url segments — and generated per call so no test can pin a literal. */
function newSealedToken() {
  return Array.from({ length: 5 }, () => randomBytes(24).toString("base64url")).join(".");
}

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

  describe("markAsClosed", () => {
    it("closes only the rows it is given", async () => {
      const { deploymentSettingRepository, settingId, createSetting, readClosed } = await setup();
      const untouchedId = await createSetting();

      await deploymentSettingRepository.markAsClosed([settingId]);

      expect(await readClosed(settingId)).toBe(true);
      expect(await readClosed(untouchedId)).toBe(false);
    });

    it("closes every row of a batch", async () => {
      const { deploymentSettingRepository, settingId, createSetting, readClosed } = await setup();
      const otherId = await createSetting();

      await deploymentSettingRepository.markAsClosed([settingId, otherId]);

      expect(await readClosed(settingId)).toBe(true);
      expect(await readClosed(otherId)).toBe(true);
    });

    it("does nothing when given no ids", async () => {
      const { deploymentSettingRepository, settingId, readClosed } = await setup();

      await deploymentSettingRepository.markAsClosed([]);

      expect(await readClosed(settingId)).toBe(false);
    });

    it("leaves a funding claim marker intact so a late release still matches it", async () => {
      const { deploymentSettingRepository, settingId } = await setup();

      const claims = await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES);
      await deploymentSettingRepository.markAsClosed([settingId]);
      await deploymentSettingRepository.releaseFundingClaim(claims);

      expect(await deploymentSettingRepository.claimForFunding([settingId], COOLDOWN_MINUTES)).toEqual([{ id: settingId, claimedAt: expect.any(String) }]);
    });
  });

  describe("findOpenInProject and markAsClosedInProject", () => {
    it("read and close only the open rows of the project inside the organization they name", async () => {
      const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
      const [tenant, foreign] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      const address = createAkashAddress();
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .insert(resolveTable("UserWallets"))
        .values({ userId: tenant.user.id, address, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });
      const otherProject = await seedProject({ organizationId: tenant.organization.id });
      const inProject = { userId: tenant.user.id, organizationId: tenant.organization.id, projectId: tenant.project.id };
      const open = await seedDeploymentSetting(inProject);
      await seedDeploymentSetting({ ...inProject, closed: true });
      const inOtherProject = await seedDeploymentSetting({ ...inProject, projectId: otherProject.id });
      const foreignSetting = await seedDeploymentSetting({ userId: foreign.user.id, organizationId: foreign.organization.id, projectId: foreign.project.id });
      const projectKey = { organizationId: tenant.organization.id, projectId: tenant.project.id };

      const found = await deploymentSettingRepository.findOpenInProject(projectKey);
      const foundAcrossOrganizations = await deploymentSettingRepository.findOpenInProject({
        organizationId: tenant.organization.id,
        projectId: foreign.project.id
      });
      await deploymentSettingRepository.markAsClosedInProject(projectKey, [open.id, inOtherProject.id, foreignSetting.id]);

      expect(found).toEqual([{ id: open.id, userId: tenant.user.id, dseq: open.dseq, address, createdAt: open.createdAt }]);
      expect(foundAcrossOrganizations).toEqual([]);
      expect(await closedById([open.id, inOtherProject.id, foreignSetting.id])).toEqual({
        [open.id]: true,
        [inOtherProject.id]: false,
        [foreignSetting.id]: false
      });
    });

    async function closedById(ids: string[]) {
      const table = resolveTable("DeploymentSettings");
      const rows = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select({ id: table.id, closed: table.closed }).from(table).where(inArray(table.id, ids));

      return Object.fromEntries(rows.map(({ id, closed }) => [id, closed]));
    }
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

  describe("markClosed", () => {
    it("records a deployment that had no settings row as closed, without turning funding on", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.markClosed({ userId: user.id, dseq });

      const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(setting).toMatchObject({ closed: true, autoTopUpEnabled: false });
    });

    it("closes an existing row without disturbing its funding setting", async () => {
      const { deploymentSettingRepository, user, createLimitedSetting } = await setup();
      const setting = await createLimitedSetting(24, { autoTopUpEnabled: true });

      await deploymentSettingRepository.markClosed({ userId: user.id, dseq: setting.dseq });

      const updated = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: setting.dseq });
      expect(updated).toMatchObject({ closed: true, autoTopUpEnabled: true });
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

    it("records the name a create was given", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG", name: "web+db" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "web+db" });
    });

    it("records no name for a definition written without one", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: null });
    });

    it("leaves a name already on the row alone when none is given", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG", name: "web" });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.1'", manifestVersion: "BQYH" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: "version: '2.1'", name: "web" });
    });

    it("replaces a name an earlier write recorded", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG", name: "web" });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG", name: "renamed" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "renamed" });
    });

    it("names a row a settings read created first", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: false });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG", name: "web" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "web" });
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

    it("returns a sealed token byte-for-byte as it was given", async () => {
      const { deploymentSettingRepository, user, sealedToken } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }))?.sealedSecrets).toBe(sealedToken);
    });

    it("records the sealed token in the same write as the sdl it belongs to", async () => {
      const { deploymentSettingRepository, user, sealedToken } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: SDL, sealedSecrets: sealedToken });
    });

    it("replaces a token an abandoned attempt left behind rather than merging with it", async () => {
      const { deploymentSettingRepository, user, sealedToken, otherSealedToken } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BQYH", sealedSecrets: otherSealedToken });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }))?.sealedSecrets).toBe(otherSealedToken);
    });

    it("clears a token an abandoned attempt left behind when the retry supplies none", async () => {
      const { deploymentSettingRepository, user, sealedToken } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BQYH", sealedSecrets: null });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }))?.sealedSecrets).toBeNull();
    });

    it("leaves a token on the row alone when the write names none", async () => {
      const { deploymentSettingRepository, user, sealedToken } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BQYH" });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }))?.sealedSecrets).toBe(sealedToken);
    });

    it("keeps the tokens of two deployments of the same user apart", async () => {
      const { deploymentSettingRepository, user, sealedToken, otherSealedToken } = await setup();
      const [first, second] = [newDseq(), newDseq()];

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: first, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });
      await deploymentSettingRepository.upsertDefinition({
        userId: user.id,
        dseq: second,
        sdl: SDL,
        manifestVersion: "BQYH",
        sealedSecrets: otherSealedToken
      });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: first }))?.sealedSecrets).toBe(sealedToken);
      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: second }))?.sealedSecrets).toBe(otherSealedToken);
    });

    it("leaves a row with no token recorded reading as null rather than as an empty string", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG" });

      expect((await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }))?.sealedSecrets).toBeNull();
    });

    it("takes the sealed token of a deployment with the owner it belongs to", async () => {
      const { deploymentSettingRepository, userRepository, user, sealedToken, db, deploymentSettingsTable } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets: sealedToken });

      await userRepository.deleteById(user.id);

      expect(await db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.dseq, dseq))).toEqual([]);
    });
  });

  describe("findListedSettings", () => {
    it("reads the settings of a whole page in one query, keyed by dseq", async () => {
      const { deploymentSettingRepository, user, abilityFor, createLimitedSetting } = await setup();
      const limited = await createLimitedSetting(5);
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: limited.dseq, name: "web" });

      const settings = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findListedSettings({ userId: user.id, dseqs: [limited.dseq] });

      expect(settings.get(limited.dseq)).toEqual({
        name: "web",
        closed: false,
        runtimeLimitHours: 5,
        runtimeEndsAt: null
      });
    });

    it("leaves a dseq the console has no row for out of the result entirely", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const unrecorded = newDseq();

      const settings = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findListedSettings({ userId: user.id, dseqs: [unrecorded] });

      expect(settings.has(unrecorded)).toBe(false);
    });

    it("refuses to read settings belonging to another user holding the same dseq", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", name: "web" });
      await deploymentSettingRepository.upsertDefinition({ userId: trialUser.id, dseq, sdl: SDL, manifestVersion: "BAUG", name: "someone else's" });

      const settings = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findListedSettings({ userId: user.id, dseqs: [dseq] });

      expect(settings.get(dseq)?.name).toBe("web");
    });

    it("reads nothing for a deployment the caller's ability excludes", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", name: "web" });

      const settings = await deploymentSettingRepository.accessibleBy(abilityFor(trialUser), "read").findListedSettings({ userId: user.id, dseqs: [dseq] });

      expect(settings.size).toBe(0);
    });

    it("issues no query at all for a page with no deployments on it", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();

      const settings = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findListedSettings({ userId: user.id, dseqs: [] });

      expect(settings.size).toBe(0);
    });
  });

  describe("findNamesByDseqs", () => {
    it("reads the names of a whole page in one query, keyed by dseq", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const named = newDseq();
      const alsoNamed = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: named, sdl: SDL, manifestVersion: "BAUG", name: "web" });
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: alsoNamed, sdl: SDL, manifestVersion: "BAUG", name: "db+web" });

      const names = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findNamesByDseqs({ userId: user.id, dseqs: [named, alsoNamed] });

      expect(names.get(named)).toBe("web");
      expect(names.get(alsoNamed)).toBe("db+web");
    });

    it("reads a null name for a deployment recorded before the column existed", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG" });

      const names = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findNamesByDseqs({ userId: user.id, dseqs: [dseq] });

      expect(names.get(dseq)).toBeNull();
    });

    it("leaves a dseq the console has no row for out of the result entirely", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const unrecorded = newDseq();

      const names = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findNamesByDseqs({ userId: user.id, dseqs: [unrecorded] });

      expect(names.has(unrecorded)).toBe(false);
    });

    it("refuses to read a name belonging to another user holding the same dseq", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", name: "web" });
      await deploymentSettingRepository.upsertDefinition({ userId: trialUser.id, dseq, sdl: SDL, manifestVersion: "BAUG", name: "someone else's" });

      const names = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findNamesByDseqs({ userId: user.id, dseqs: [dseq] });

      expect(names.get(dseq)).toBe("web");
    });

    it("reads nothing for a deployment the caller's ability excludes", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", name: "web" });

      const names = await deploymentSettingRepository.accessibleBy(abilityFor(trialUser), "read").findNamesByDseqs({ userId: user.id, dseqs: [dseq] });

      expect(names.size).toBe(0);
    });

    it("issues no query at all for a page with no deployments on it", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();

      const names = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findNamesByDseqs({ userId: user.id, dseqs: [] });

      expect(names.size).toBe(0);
    });
  });

  describe("findDseqsByNameContaining", () => {
    it("returns the dseqs of the deployments whose name contains the text, whatever its case", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const [web, otherWeb, database] = [newDseq(), newDseq(), newDseq()];
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: web, name: "My Web App" });
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: otherWeb, name: "webhooks" });
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: database, name: "database" });

      const dseqs = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findDseqsByNameContaining({ userId: user.id, text: "web" });

      expect(dseqs.sort()).toEqual([web, otherWeb].sort());
    });

    it("matches a wildcard in the text only against itself", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const [discounted, plain] = [newDseq(), newDseq()];
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: discounted, name: "50%_off" });
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: plain, name: "500 off" });

      const dseqs = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findDseqsByNameContaining({ userId: user.id, text: "0%_" });

      expect(dseqs).toEqual([discounted]);
    });

    it("leaves out a deployment the console holds no name for", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const unnamed = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: unnamed, sdl: SDL, manifestVersion: "BAUG" });

      const dseqs = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findDseqsByNameContaining({ userId: user.id, text: "" });

      expect(dseqs).not.toContain(unnamed);
    });

    it("leaves out the deployments another user named", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const theirs = newDseq();
      await deploymentSettingRepository.upsertName({ userId: trialUser.id, dseq: theirs, name: "web" });

      const dseqs = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findDseqsByNameContaining({ userId: user.id, text: "web" });

      expect(dseqs).toEqual([]);
    });

    it("reads nothing for a user the caller's ability excludes", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: newDseq(), name: "web" });

      const dseqs = await deploymentSettingRepository.accessibleBy(abilityFor(trialUser), "read").findDseqsByNameContaining({ userId: user.id, text: "web" });

      expect(dseqs).toEqual([]);
    });
  });

  describe("findLeaseGpus", () => {
    it("reads the gpu readings and offers of a whole page in one query, keyed by dseq", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const read = newDseq();
      const offered = newDseq();
      const reading = createLeaseGpuReading();
      const offer = createLeaseGpuOffer();
      await seedDeploymentSetting({ userId: user.id, dseq: read, detectedGpus: [reading] });
      await seedDeploymentSetting({ userId: user.id, dseq: offered, offeredGpus: [offer] });

      const stored = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findLeaseGpus({ userId: user.id, dseqs: [read, offered] });

      expect(stored).toEqual(
        new Map([
          [read, { readings: [reading], offers: [] }],
          [offered, { readings: [], offers: [offer] }]
        ])
      );
    });

    it("leaves a deployment with neither readings nor offers out of the result", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const unrecorded = newDseq();
      await seedDeploymentSetting({ userId: user.id, dseq: unrecorded });

      const stored = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findLeaseGpus({ userId: user.id, dseqs: [unrecorded] });

      expect(stored.has(unrecorded)).toBe(false);
    });

    it("refuses to read what another user holding the same dseq has recorded", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const dseq = newDseq();
      const reading = createLeaseGpuReading();
      await seedDeploymentSetting({ userId: user.id, dseq, detectedGpus: [reading] });
      await seedDeploymentSetting({ userId: trialUser.id, dseq, offeredGpus: [createLeaseGpuOffer()] });

      const stored = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findLeaseGpus({ userId: user.id, dseqs: [dseq] });

      expect(stored.get(dseq)).toEqual({ readings: [reading], offers: [] });
    });

    it("reads nothing for a deployment the caller's ability excludes", async () => {
      const { deploymentSettingRepository, user, trialUser, abilityFor } = await setup();
      const dseq = newDseq();
      await seedDeploymentSetting({ userId: user.id, dseq, detectedGpus: [createLeaseGpuReading()], offeredGpus: [createLeaseGpuOffer()] });

      const stored = await deploymentSettingRepository.accessibleBy(abilityFor(trialUser), "read").findLeaseGpus({ userId: user.id, dseqs: [dseq] });

      expect(stored.size).toBe(0);
    });

    it("issues no query at all for a page with no deployments on it", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();

      const stored = await deploymentSettingRepository.accessibleBy(abilityFor(user), "read").findLeaseGpus({ userId: user.id, dseqs: [] });

      expect(stored.size).toBe(0);
    });
  });

  describe("findRecentNvidiaDrivers", () => {
    const since = new Date("2026-09-01T00:00:00.000Z");

    it("lists each driver read on a provider once, across deployments and their owners, newest first", async () => {
      const { deploymentSettingRepository, user, trialUser } = await setup();
      const provider = createAkashAddress();
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [
          createLeaseGpuReading({ provider, driverVersion: "550.54.15", detectedAt: "2026-09-10T08:00:00.000Z" }),
          createLeaseGpuReading({ gseq: 2, driverVersion: "570.86.15", detectedAt: "2026-09-25T08:00:00.000Z" })
        ]
      });
      await seedDeploymentSetting({
        userId: trialUser.id,
        dseq: newDseq(),
        detectedGpus: [createLeaseGpuReading({ provider, driverVersion: "550.54.15", detectedAt: "2026-09-21T23:30:00.000Z" })]
      });
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [createLeaseGpuReading({ provider, driverVersion: "535.183.01", detectedAt: "2026-09-15T08:00:00.000Z" })]
      });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider, since, limit: 5, minOwners: 1 });

      expect(drivers).toEqual([
        { driverVersion: "550.54.15", lastSeenDate: "2026-09-21" },
        { driverVersion: "535.183.01", lastSeenDate: "2026-09-15" }
      ]);
    });

    it("leaves out a driver read only before the cutoff", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const provider = createAkashAddress();
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [
          createLeaseGpuReading({ provider, service: "web", driverVersion: "535.54.03", detectedAt: "2026-08-31T23:59:59.000Z" }),
          createLeaseGpuReading({ provider, service: "worker", driverVersion: "550.54.15", detectedAt: "2026-09-01T00:00:00.000Z" })
        ]
      });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider, since, limit: 5, minOwners: 1 });

      expect(drivers).toEqual([{ driverVersion: "550.54.15", lastSeenDate: "2026-09-01" }]);
    });

    it("leaves out readings that carry no nvidia driver", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const provider = createAkashAddress();
      const detectedAt = "2026-09-21T10:00:00.000Z";
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [
          createLeaseGpuReading({ provider, service: "amd", source: "rocm-smi", driverVersion: null, detectedAt }),
          createLeaseGpuReading({ provider, service: "cpu", source: "none", driverVersion: null, gpus: [], detectedAt }),
          createLeaseGpuReading({ provider, service: "unread", source: "nvidia-smi", driverVersion: null, detectedAt })
        ]
      });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider, since, limit: 5, minOwners: 1 });

      expect(drivers).toEqual([]);
    });

    it("leaves out a driver version that is not shaped like an nvidia driver version", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const provider = createAkashAddress();
      const detectedAt = "2026-09-21T10:00:00.000Z";
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [
          createLeaseGpuReading({ provider, service: "prose", driverVersion: "see example.com", detectedAt }),
          createLeaseGpuReading({ provider, service: "suffix", driverVersion: "550.54.15-custom", detectedAt }),
          createLeaseGpuReading({ provider, service: "major", driverVersion: "5500.54.15", detectedAt }),
          createLeaseGpuReading({ provider, service: "real", driverVersion: "570.26", detectedAt })
        ]
      });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider, since, limit: 5, minOwners: 1 });

      expect(drivers).toEqual([{ driverVersion: "570.26", lastSeenDate: "2026-09-21" }]);
    });

    it("keeps only the most recently read drivers up to the limit", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const provider = createAkashAddress();
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [
          createLeaseGpuReading({ provider, service: "a", driverVersion: "535.183.01", detectedAt: "2026-09-05T10:00:00.000Z" }),
          createLeaseGpuReading({ provider, service: "b", driverVersion: "550.54.15", detectedAt: "2026-09-20T10:00:00.000Z" }),
          createLeaseGpuReading({ provider, service: "c", driverVersion: "570.86.15", detectedAt: "2026-09-12T10:00:00.000Z" })
        ]
      });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider, since, limit: 2, minOwners: 1 });

      expect(drivers.map(driver => driver.driverVersion)).toEqual(["550.54.15", "570.86.15"]);
    });

    it("leaves out a driver version reported by fewer owners than required, however many deployments reported it", async () => {
      const { deploymentSettingRepository, user, trialUser } = await setup();
      const provider = createAkashAddress();
      const detectedAt = "2026-09-21T10:00:00.000Z";
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [
          createLeaseGpuReading({ provider, service: "shared", driverVersion: "550.54.15", detectedAt }),
          createLeaseGpuReading({ provider, service: "single", driverVersion: "570.86.15", detectedAt })
        ]
      });
      await seedDeploymentSetting({
        userId: user.id,
        dseq: newDseq(),
        detectedGpus: [createLeaseGpuReading({ provider, driverVersion: "570.86.15", detectedAt })]
      });
      await seedDeploymentSetting({
        userId: trialUser.id,
        dseq: newDseq(),
        detectedGpus: [createLeaseGpuReading({ provider, driverVersion: "550.54.15", detectedAt })]
      });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider, since, limit: 5, minOwners: 2 });

      expect(drivers).toEqual([{ driverVersion: "550.54.15", lastSeenDate: "2026-09-21" }]);
    });

    it("reads nothing for a provider no lease has been read on", async () => {
      const { deploymentSettingRepository, user } = await setup();
      await seedDeploymentSetting({ userId: user.id, dseq: newDseq(), detectedGpus: [createLeaseGpuReading({ detectedAt: "2026-09-21T10:00:00.000Z" })] });

      const drivers = await deploymentSettingRepository.findRecentNvidiaDrivers({ provider: createAkashAddress(), since, limit: 5, minOwners: 1 });

      expect(drivers).toEqual([]);
    });
  });

  describe("mergeGpuReadings", () => {
    it("stores the first readings of a deployment the probe never read", async () => {
      const { deploymentSettingRepository, user, readGpuReadings } = await setup();
      const dseq = newDseq();
      const reading = createLeaseGpuReading();
      await seedDeploymentSetting({ userId: user.id, dseq });

      await expect(deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [reading] })).resolves.toBe(true);

      await expect(readGpuReadings(user.id, dseq)).resolves.toEqual([reading]);
    });

    it("replaces a service read again and keeps every other service it was not given", async () => {
      const { deploymentSettingRepository, user, readGpuReadings } = await setup();
      const dseq = newDseq();
      const web = createLeaseGpuReading({ provider: "akash1provider", service: "web" });
      const worker = createLeaseGpuReading({ provider: "akash1provider", service: "worker" });
      const rereadWeb = createLeaseGpuReading({ provider: "akash1provider", service: "web", driverVersion: "565.57.01" });
      await seedDeploymentSetting({ userId: user.id, dseq, detectedGpus: [web, worker] });

      await deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [rereadWeb] });

      await expect(readGpuReadings(user.id, dseq)).resolves.toEqual([worker, rereadWeb]);
    });

    it("leaves every other column of the row as it was", async () => {
      const { deploymentSettingRepository, user, readDefinition } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG" });

      await deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [createLeaseGpuReading()] });

      await expect(readDefinition(dseq)).resolves.toEqual({ sdl: SDL, manifestVersion: "BAUG", sealedSecrets: null });
    });

    it("writes nothing to another user holding the same dseq", async () => {
      const { deploymentSettingRepository, user, trialUser, readGpuReadings } = await setup();
      const dseq = newDseq();
      await seedDeploymentSetting({ userId: user.id, dseq });
      await seedDeploymentSetting({ userId: trialUser.id, dseq });

      await deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [createLeaseGpuReading()] });

      await expect(readGpuReadings(trialUser.id, dseq)).resolves.toBeNull();
    });

    it("reports a deployment the console holds no row for, rather than creating one", async () => {
      const { deploymentSettingRepository, user, db, deploymentSettingsTable } = await setup();
      const dseq = newDseq();

      await expect(deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [createLeaseGpuReading()] })).resolves.toBe(false);

      const rows = await db
        .select({ id: deploymentSettingsTable.id })
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, user.id), eq(deploymentSettingsTable.dseq, dseq)));
      expect(rows).toEqual([]);
    });

    it("keeps both writers' readings when two land on the same row at once", async () => {
      const { deploymentSettingRepository, user, readGpuReadings } = await setup();
      const dseq = newDseq();
      const web = createLeaseGpuReading({ service: "web" });
      const worker = createLeaseGpuReading({ service: "worker" });
      await seedDeploymentSetting({ userId: user.id, dseq });

      await Promise.all([
        deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [web] }),
        deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [worker] })
      ]);

      const stored = await readGpuReadings(user.id, dseq);
      expect(stored?.map(reading => reading.service).sort()).toEqual(["web", "worker"]);
    });
  });

  describe("mergeGpuOffers", () => {
    it("stores the first offers of a deployment never recorded", async () => {
      const { deploymentSettingRepository, user, readGpuOffers } = await setup();
      const dseq = newDseq();
      const offer = createLeaseGpuOffer();
      await seedDeploymentSetting({ userId: user.id, dseq });

      await expect(deploymentSettingRepository.mergeGpuOffers({ userId: user.id, dseq, offers: [offer] })).resolves.toBe(true);

      await expect(readGpuOffers(user.id, dseq)).resolves.toEqual([offer]);
    });

    it("replaces the offer of a lease recorded again and keeps every other lease's", async () => {
      const { deploymentSettingRepository, user, readGpuOffers } = await setup();
      const dseq = newDseq();
      const first = createLeaseGpuOffer({ provider: "akash1provider", gseq: 1 });
      const second = createLeaseGpuOffer({ provider: "akash1provider", gseq: 2 });
      const firstAgain = createLeaseGpuOffer({ provider: "akash1provider", gseq: 1, recordedAt: "2026-09-26T10:00:00.000Z" });
      await seedDeploymentSetting({ userId: user.id, dseq, offeredGpus: [first, second] });

      await deploymentSettingRepository.mergeGpuOffers({ userId: user.id, dseq, offers: [firstAgain] });

      await expect(readGpuOffers(user.id, dseq)).resolves.toEqual([second, firstAgain]);
    });

    it("leaves the probe's readings of the same row as they were", async () => {
      const { deploymentSettingRepository, user, readGpuReadings } = await setup();
      const dseq = newDseq();
      const reading = createLeaseGpuReading();
      await seedDeploymentSetting({ userId: user.id, dseq, detectedGpus: [reading] });

      await deploymentSettingRepository.mergeGpuOffers({ userId: user.id, dseq, offers: [createLeaseGpuOffer()] });

      await expect(readGpuReadings(user.id, dseq)).resolves.toEqual([reading]);
    });

    it("reports a deployment the console holds no row for, rather than creating one", async () => {
      const { deploymentSettingRepository, user } = await setup();

      await expect(deploymentSettingRepository.mergeGpuOffers({ userId: user.id, dseq: newDseq(), offers: [createLeaseGpuOffer()] })).resolves.toBe(false);
    });

    it("keeps both the offers and the readings when the two writers land on the row at once", async () => {
      const { deploymentSettingRepository, user, readGpuOffers, readGpuReadings } = await setup();
      const dseq = newDseq();
      const offer = createLeaseGpuOffer();
      const reading = createLeaseGpuReading();
      await seedDeploymentSetting({ userId: user.id, dseq });

      await Promise.all([
        deploymentSettingRepository.mergeGpuOffers({ userId: user.id, dseq, offers: [offer] }),
        deploymentSettingRepository.mergeGpuReadings({ userId: user.id, dseq, readings: [reading] })
      ]);

      await expect(readGpuOffers(user.id, dseq)).resolves.toEqual([offer]);
      await expect(readGpuReadings(user.id, dseq)).resolves.toEqual([reading]);
    });
  });

  describe("findLiveManagedDeployments", () => {
    it("says which candidates already have their bid offers recorded", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const recorded = newDseq();
      const unrecorded = newDseq();
      await seedDeploymentSetting({ userId: user.id, dseq: recorded, offeredGpus: [createLeaseGpuOffer()] });
      await seedDeploymentSetting({ userId: user.id, dseq: unrecorded });

      const deployments = await deploymentSettingRepository.findLiveManagedDeployments({ maxAgeHours: 1 });

      const seeded = deployments.filter(deployment => deployment.userId === user.id && [recorded, unrecorded].includes(deployment.dseq));
      expect(Object.fromEntries(seeded.map(deployment => [deployment.dseq, deployment.hasOfferedGpus]))).toEqual({ [recorded]: true, [unrecorded]: false });
    });

    it("says which candidates the probe has already read", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const read = newDseq();
      const unread = newDseq();
      await seedDeploymentSetting({ userId: user.id, dseq: read, detectedGpus: [createLeaseGpuReading()] });
      await seedDeploymentSetting({ userId: user.id, dseq: unread });

      const deployments = await deploymentSettingRepository.findLiveManagedDeployments({ maxAgeHours: 1 });

      const seeded = deployments.filter(deployment => deployment.userId === user.id && [read, unread].includes(deployment.dseq));
      expect(Object.fromEntries(seeded.map(deployment => [deployment.dseq, deployment.hasDetectedGpus]))).toEqual({ [read]: true, [unread]: false });
    });
  });

  describe("findAutoTopUpDeploymentsByOwnerIteratively", () => {
    it("gathers every deployment of an owner into a single yield", async () => {
      const { createSetting, wallet, findAutoTopUpOwners } = await setup();
      await createSetting();

      const owners = await findAutoTopUpOwners([wallet.address]);

      expect(owners).toHaveLength(1);
      expect(owners[0].deploymentSettings).toHaveLength(2);
    });

    it("reports the wallet each owner funds from", async () => {
      const { wallet, findAutoTopUpOwners } = await setup();

      const owners = await findAutoTopUpOwners([wallet.address]);

      expect(owners[0]).toMatchObject({ address: wallet.address, walletId: wallet.walletId });
    });

    it("keeps two owners apart", async () => {
      const { createSetting, trialUser, wallet, trialWallet, findAutoTopUpOwners } = await setup();
      await createSetting(trialUser.id);

      const owners = await findAutoTopUpOwners([wallet.address, trialWallet.address]);

      expect(owners.map(owner => owner.address).sort()).toEqual([wallet.address, trialWallet.address].sort());
      expect(owners.map(owner => owner.deploymentSettings.length)).toEqual([1, 1]);
    });

    it("passes over a deployment whose owner turned auto top-up off", async () => {
      const { deploymentSettingRepository, user, wallet, findAutoTopUpOwners } = await setup();
      await deploymentSettingRepository.create({ userId: user.id, dseq: newDseq(), autoTopUpEnabled: false });

      const owners = await findAutoTopUpOwners([wallet.address]);

      expect(owners[0].deploymentSettings).toHaveLength(1);
    });

    it("passes over a deployment already marked closed", async () => {
      const { deploymentSettingRepository, createSetting, wallet, findAutoTopUpOwners } = await setup();
      const closedId = await createSetting();
      await deploymentSettingRepository.markAsClosed([closedId]);

      const owners = await findAutoTopUpOwners([wallet.address]);

      expect(owners[0].deploymentSettings.map(deployment => deployment.id)).not.toContain(closedId);
    });

    it("drops an owner whose only deployment is closed", async () => {
      const { deploymentSettingRepository, settingId, wallet, findAutoTopUpOwners } = await setup();
      await deploymentSettingRepository.markAsClosed([settingId]);

      expect(await findAutoTopUpOwners([wallet.address])).toEqual([]);
    });

    it("yields the same deployments the per-owner lookup returns", async () => {
      const { deploymentSettingRepository, createSetting, wallet, findAutoTopUpOwners } = await setup();
      await createSetting();

      const owners = await findAutoTopUpOwners([wallet.address]);

      expect(owners[0].deploymentSettings).toEqual(await deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(wallet.address));
    });
  });

  describe("findOpenDeploymentsIteratively", () => {
    it("yields an open deployment whose owner turned funding off, which the funding sweep never reaches", async () => {
      const { deploymentSettingRepository, user, wallet, findOpenDeployments } = await setup();
      const fundingOff = await deploymentSettingRepository.create({ userId: user.id, dseq: newDseq(), autoTopUpEnabled: false });

      const open = await findOpenDeployments([wallet.address]);

      expect(open.map(deployment => deployment.id)).toContain(fundingOff.id);
    });

    it("reports what a chain lookup and a compensation for the record need", async () => {
      const { deploymentSettingRepository, settingId, user, wallet, findOpenDeployments } = await setup();
      const setting = await deploymentSettingRepository.findById(settingId);

      const open = await findOpenDeployments([wallet.address]);

      expect(open).toContainEqual({ id: settingId, userId: user.id, dseq: setting!.dseq, address: wallet.address, createdAt: new Date(setting!.createdAt) });
    });

    it("passes over a deployment already marked closed", async () => {
      const { deploymentSettingRepository, settingId, wallet, findOpenDeployments } = await setup();
      await deploymentSettingRepository.markAsClosed([settingId]);

      const open = await findOpenDeployments([wallet.address]);

      expect(open.map(deployment => deployment.id)).not.toContain(settingId);
    });

    it("passes over a deployment whose wallet has no address yet, since there is nothing to look up", async () => {
      const { deploymentSettingRepository, userRepository, db, userWalletsTable, findOpenDeployments } = await setup();
      const walletlessUser = await userRepository.create({ userId: faker.string.uuid() });
      await db.insert(userWalletsTable).values({ userId: walletlessUser.id, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });
      const setting = await deploymentSettingRepository.create({ userId: walletlessUser.id, dseq: newDseq(), autoTopUpEnabled: true });

      const open = await findOpenDeployments();

      expect(open.map(deployment => deployment.id)).not.toContain(setting.id);
    });

    it("pages every open deployment exactly once when the batch is smaller than the set", async () => {
      const { createSetting, wallet, findOpenDeployments } = await setup();
      await createSetting();
      await createSetting();
      await createSetting();

      const oneAtATime = await findOpenDeployments([wallet.address], 1);
      const allAtOnce = await findOpenDeployments([wallet.address], 1000);

      expect(allAtOnce).toHaveLength(4);
      expect(oneAtATime.map(deployment => deployment.id).sort()).toEqual(allAtOnce.map(deployment => deployment.id).sort());
    });

    it("yields batches no larger than the size asked for", async () => {
      const { deploymentSettingRepository, createSetting } = await setup();
      await createSetting();
      await createSetting();
      await createSetting();
      const sizes: number[] = [];

      for await (const batch of deploymentSettingRepository.findOpenDeploymentsIteratively({ batchSize: 2 })) {
        sizes.push(batch.length);
      }

      expect(Math.max(...sizes)).toBeLessThanOrEqual(2);
    });
  });

  describe("findStoredSecretsIteratively", () => {
    it("refuses a batch size of zero, which would read as a fleet holding no secrets", async () => {
      const { deploymentSettingRepository } = await setup();

      await expect(deploymentSettingRepository.findStoredSecretsIteratively({ batchSize: 0 }).next()).rejects.toThrow("Batch size must be a positive integer");
    });

    it("yields a deployment's token under the id that holds it", async () => {
      const { sealedToken, createSettingWithSecrets, findStoredSecrets } = await setup();
      const id = await createSettingWithSecrets(sealedToken);

      const stored = await findStoredSecrets([id]);

      expect(stored).toEqual([{ id, sealedSecrets: sealedToken, updatedAt: expect.any(Date) }]);
    });

    it("passes over a deployment holding no token, which no fingerprint has anything to say about", async () => {
      const { sealedToken, createSetting, createSettingWithSecrets, findStoredSecrets } = await setup();
      const withoutSecrets = await createSetting();
      const withSecrets = await createSettingWithSecrets(sealedToken);

      const stored = await findStoredSecrets([withoutSecrets, withSecrets]);

      expect(stored.map(row => row.id)).toEqual([withSecrets]);
    });

    it("pages every token-holding deployment exactly once when the batch is smaller than the set", async () => {
      const { sealedToken, otherSealedToken, createSettingWithSecrets, findStoredSecrets } = await setup();
      const ids = [await createSettingWithSecrets(sealedToken), await createSettingWithSecrets(otherSealedToken), await createSettingWithSecrets(sealedToken)];

      const oneAtATime = await findStoredSecrets(ids, 1);
      const allAtOnce = await findStoredSecrets(ids, 1000);

      expect(allAtOnce).toHaveLength(3);
      expect(oneAtATime).toEqual(allAtOnce);
    });

    it("yields rows in id order, so each batch stays an index scan on the primary key", async () => {
      const { sealedToken, createSettingWithSecrets, findStoredSecrets } = await setup();
      const ids = [await createSettingWithSecrets(sealedToken), await createSettingWithSecrets(sealedToken), await createSettingWithSecrets(sealedToken)];

      const stored = await findStoredSecrets(ids, 2);

      expect(stored.map(row => row.id)).toEqual([...ids].sort());
    });

    it("yields batches no larger than the size asked for", async () => {
      const { sealedToken, deploymentSettingRepository, createSettingWithSecrets } = await setup();
      await createSettingWithSecrets(sealedToken);
      await createSettingWithSecrets(sealedToken);
      await createSettingWithSecrets(sealedToken);
      const sizes: number[] = [];

      for await (const batch of deploymentSettingRepository.findStoredSecretsIteratively({ batchSize: 2 })) {
        sizes.push(batch.length);
      }

      expect(Math.max(...sizes)).toBeLessThanOrEqual(2);
    });
  });

  describe("createDefaultIfMissing", () => {
    it("records a deployment nothing had recorded yet, with funding on", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      const created = await deploymentSettingRepository.createDefaultIfMissing({ userId: user.id, dseq });

      expect(created).toBe(true);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
    });

    it("leaves the choices of a row another path already wrote", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: false, runtimeLimitHours: 12 });

      const created = await deploymentSettingRepository.createDefaultIfMissing({ userId: user.id, dseq });

      expect(created).toBe(false);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toEqual(
        expect.objectContaining({ autoTopUpEnabled: false, runtimeLimitHours: 12 })
      );
    });

    it("writes one row across concurrent attempts for the same deployment", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      const results = await Promise.all(Array.from({ length: 5 }, () => deploymentSettingRepository.createDefaultIfMissing({ userId: user.id, dseq })));

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  function newDseq() {
    return faker.number.int({ min: 100000, max: 999999 }).toString();
  }

  describe("findLiveTrialDeployments", () => {
    it("returns open trial deployments created inside the window with their wallet id", async () => {
      const { deploymentSettingRepository, user, trialUser, trialWallet, createSetting, db, deploymentSettingsTable } = await setup();
      const liveDseq = faker.number.int({ min: 100000, max: 999999 }).toString();
      await db.insert(deploymentSettingsTable).values({ userId: trialUser.id, dseq: liveDseq, autoTopUpEnabled: true });
      await db.insert(deploymentSettingsTable).values({ userId: trialUser.id, dseq: `1`, autoTopUpEnabled: true, closed: true });
      await db
        .insert(deploymentSettingsTable)
        .values({ userId: trialUser.id, dseq: `2`, autoTopUpEnabled: true, createdAt: new Date(Date.now() - hoursToMilliseconds(48)) });
      await createSetting();

      const deployments = await deploymentSettingRepository.findLiveTrialDeployments({ maxAgeHours: 26 });

      const ofTrialUser = deployments.filter(deployment => deployment.userId === trialUser.id);
      expect(ofTrialUser).toEqual([{ userId: trialUser.id, dseq: liveDseq, walletId: trialWallet.walletId, createdAt: expect.any(Date) }]);
      expect(deployments.map(deployment => deployment.userId)).not.toContain(user.id);
    });

    it("selects the same deployments whatever the session time zone", async () => {
      const { deploymentSettingRepository, trialUser, deploymentSettingsTable } = await setup();
      const txService = container.resolve(TxService);
      const insideWindowDseq = faker.number.int({ min: 100000, max: 999999 }).toString();
      const outsideWindowDseq = faker.number.int({ min: 100000, max: 999999 }).toString();

      const dseqs = await txService.transaction(async () => {
        const tx = txService.getPgTx()!;
        await tx.execute(sql`set local time zone 'Asia/Tokyo'`);
        await tx.insert(deploymentSettingsTable).values([
          { userId: trialUser.id, dseq: insideWindowDseq, autoTopUpEnabled: true, createdAt: sql`now() - interval '25 hours'` },
          { userId: trialUser.id, dseq: outsideWindowDseq, autoTopUpEnabled: true, createdAt: sql`now() - interval '27 hours'` }
        ]);

        return (await deploymentSettingRepository.findLiveTrialDeployments({ maxAgeHours: 26 })).map(deployment => deployment.dseq);
      });

      expect(dseqs).toContain(insideWindowDseq);
      expect(dseqs).not.toContain(outsideWindowDseq);
    });

    it("leaves the deployments of a wallet locked for abuse out of the sweep", async () => {
      const { deploymentSettingRepository, trialUser, trialWallet, db, deploymentSettingsTable, userWalletsTable } = await setup();
      await db
        .insert(deploymentSettingsTable)
        .values({ userId: trialUser.id, dseq: faker.number.int({ min: 100000, max: 999999 }).toString(), autoTopUpEnabled: true });
      await db.update(userWalletsTable).set({ abuseLockedAt: new Date() }).where(eq(userWalletsTable.id, trialWallet.walletId));

      const deployments = await deploymentSettingRepository.findLiveTrialDeployments({ maxAgeHours: 26 });

      expect(deployments.some(deployment => deployment.userId === trialUser.id)).toBe(false);
    });
  });

  describe("replaceDefinitionIfVersionMatches", () => {
    it("replaces the definition when the version the caller read is still current", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        expectedManifestVersion: "AAAA"
      });

      expect(recorded?.id).toEqual(expect.any(String));
      expect(await readDefinition(dseq)).toMatchObject({
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken
      });
    });

    it("refuses when the version the caller read is no longer current", async () => {
      const { deploymentSettingRepository, user, createDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        expectedManifestVersion: "STALE"
      });

      expect(recorded).toBeUndefined();
    });

    it("leaves every column as it was when it refuses", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, sealedToken, otherSealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA", sealedSecrets: otherSealedToken });
      const before = await readDefinition(dseq);

      await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        expectedManifestVersion: "STALE"
      });

      expect(await readDefinition(dseq)).toEqual(before);
    });

    it("accepts a retry whose row already carries the version it computes, so a repeat is not a conflict", async () => {
      const { deploymentSettingRepository, user, createDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "BBBB" });

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        expectedManifestVersion: "AAAA"
      });

      expect(recorded?.id).toEqual(expect.any(String));
    });

    it("leaves the row at the version the retry recomputed", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "BBBB" });

      await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        expectedManifestVersion: "AAAA"
      });

      expect(await readDefinition(dseq)).toMatchObject({ sdl: "version: '2.0' # patched", manifestVersion: "BBBB", sealedSecrets: sealedToken });
    });

    it("refuses a version that is neither the one the caller read nor the one it computes", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "CCCC" });

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        expectedManifestVersion: "AAAA"
      });

      expect(recorded).toBeUndefined();
      expect(await readDefinition(dseq)).toMatchObject({ manifestVersion: "CCCC" });
    });

    it("awards the write to exactly one of several patches that read the same version", async () => {
      const { deploymentSettingRepository, user, createDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const results = await Promise.all(
        Array.from({ length: 5 }, (_, attempt) =>
          deploymentSettingRepository.replaceDefinitionIfVersionMatches({
            userId: user.id,
            dseq,
            sdl: `version: '2.0' # patch ${attempt}`,
            manifestVersion: `V${attempt}`,
            sealedSecrets: sealedToken,
            expectedManifestVersion: "AAAA"
          })
        )
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("leaves the one version that won as the current one", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      await Promise.all(
        Array.from({ length: 5 }, (_, attempt) =>
          deploymentSettingRepository.replaceDefinitionIfVersionMatches({
            userId: user.id,
            dseq,
            sdl: `version: '2.0' # patch ${attempt}`,
            manifestVersion: `V${attempt}`,
            sealedSecrets: sealedToken,
            expectedManifestVersion: "AAAA"
          })
        )
      );

      const stored = await readDefinition(dseq);
      expect(stored?.manifestVersion).toMatch(/^V\d$/);
      expect(stored?.sdl).toBe(`version: '2.0' # patch ${stored?.manifestVersion?.slice(1)}`);
    });

    it("replaces without a guard when the caller states no expectation", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken
      });

      expect(recorded?.id).toEqual(expect.any(String));
      expect(await readDefinition(dseq)).toMatchObject({ manifestVersion: "BBBB" });
    });

    it("clears the token when the merged set of secrets is empty", async () => {
      const { deploymentSettingRepository, user, createDefinition, readDefinition, otherSealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA", sealedSecrets: otherSealedToken });

      await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: null,
        expectedManifestVersion: "AAAA"
      });

      expect(await readDefinition(dseq)).toMatchObject({ sealedSecrets: null });
    });

    it("refuses a row that records no sdl, which a patch has nothing to build on", async () => {
      const { deploymentSettingRepository, user, createSetting, readSettingDseq, sealedToken } = await setup();
      const settingId = await createSetting();
      const dseq = await readSettingDseq(settingId);

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken
      });

      expect(recorded).toBeUndefined();
    });

    it("refuses a deployment belonging to another user", async () => {
      const { deploymentSettingRepository, trialUser, createDefinition, readDefinition, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const recorded = await deploymentSettingRepository.replaceDefinitionIfVersionMatches({
        userId: trialUser.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken
      });

      expect(recorded).toBeUndefined();
      expect(await readDefinition(dseq)).toMatchObject({ manifestVersion: "AAAA" });
    });

    it("refuses a deployment the caller's ability excludes", async () => {
      const { deploymentSettingRepository, user, trialUser, createDefinition, readDefinition, abilityFor, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const recorded = await deploymentSettingRepository.accessibleBy(abilityFor(trialUser), "update").replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken
      });

      expect(recorded).toBeUndefined();
      expect(await readDefinition(dseq)).toMatchObject({ manifestVersion: "AAAA" });
    });

    it("records a name beside the definition it replaces", async () => {
      const { deploymentSettingRepository, user, createDefinition, abilityFor, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      await deploymentSettingRepository.accessibleBy(abilityFor(user), "update").replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        name: "renamed"
      });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "renamed" });
    });

    it("hands back the name it recorded beside the definition", async () => {
      const { deploymentSettingRepository, user, createDefinition, abilityFor, sealedToken } = await setup();
      const dseq = await createDefinition({ manifestVersion: "AAAA" });

      const recorded = await deploymentSettingRepository.accessibleBy(abilityFor(user), "update").replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken,
        name: "renamed"
      });

      expect(recorded?.name).toBe("renamed");
    });

    it("leaves a name already on the row alone when the replacement names none", async () => {
      const { deploymentSettingRepository, user, abilityFor, sealedToken } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "AAAA", name: "web" });

      const recorded = await deploymentSettingRepository.accessibleBy(abilityFor(user), "update").replaceDefinitionIfVersionMatches({
        userId: user.id,
        dseq,
        sdl: "version: '2.0' # patched",
        manifestVersion: "BBBB",
        sealedSecrets: sealedToken
      });

      expect(recorded?.name).toBe("web");
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ manifestVersion: "BBBB", name: "web" });
    });
  });

  describe("upsertName", () => {
    it("names a deployment the console holds no row for at all", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.upsertName({ userId: user.id, dseq, name: "renamed" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "renamed", sdl: null });
    });

    it("replaces the name on a row that already carries one", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "AAAA", name: "web" });

      await deploymentSettingRepository.upsertName({ userId: user.id, dseq, name: "renamed" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "renamed" });
    });

    it("leaves the definition it finds on the row untouched", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "AAAA" });

      await deploymentSettingRepository.upsertName({ userId: user.id, dseq, name: "renamed" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: SDL, manifestVersion: "AAAA", name: "renamed" });
    });

    it("hands back the name it stored, whether it created the row or replaced one", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      const created = await deploymentSettingRepository.upsertName({ userId: user.id, dseq, name: "first" });
      const replaced = await deploymentSettingRepository.upsertName({ userId: user.id, dseq, name: "renamed" });

      expect(created).toBe("first");
      expect(replaced).toBe("renamed");
    });

    it("names only the caller's own row when another user holds the same dseq", async () => {
      const { deploymentSettingRepository, user, trialUser } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: trialUser.id, dseq, sdl: SDL, manifestVersion: "AAAA", name: "not yours" });

      await deploymentSettingRepository.upsertName({ userId: user.id, dseq, name: "renamed" });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ name: "renamed" });
      expect(await deploymentSettingRepository.findOneBy({ userId: trialUser.id, dseq })).toMatchObject({ name: "not yours" });
    });
  });

  describe("findLocation", () => {
    it("locates a deployment of an organization the user owns, with the project it is filed into", async () => {
      const { deploymentSettingRepository } = await setupOrganizations();
      const { user, organization } = await seedOrganizationWithOwner();
      const project = await seedProject({ organizationId: organization.id });
      const setting = await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: project.id });

      expect(await deploymentSettingRepository.findLocation({ userId: user.id, dseq: setting.dseq })).toEqual({
        organizationId: organization.id,
        organizationSlug: organization.slug,
        projectId: project.id
      });
    });

    it("locates another member's deployment for an admin", async () => {
      const { deploymentSettingRepository, active, member } = await setupOrganizations();
      const admin = await container.resolve(UserRepository).create({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: active.organization.id, userId: admin.id, role: "admin" });
      const setting = await seedDeploymentSetting({ userId: member.id, organizationId: active.organization.id, projectId: active.project.id });

      expect(await deploymentSettingRepository.findLocation({ userId: admin.id, dseq: setting.dseq })).toMatchObject({
        organizationId: active.organization.id
      });
    });

    it("locates a deployment of a project a member was granted", async () => {
      const { deploymentSettingRepository, active, member, otherProject } = await setupOrganizations();
      await seedProjectMember({ organizationId: active.organization.id, projectId: otherProject.id, userId: member.id });
      const setting = await seedDeploymentSetting({ userId: active.user.id, organizationId: active.organization.id, projectId: otherProject.id });

      expect(await deploymentSettingRepository.findLocation({ userId: member.id, dseq: setting.dseq })).toMatchObject({
        projectId: otherProject.id
      });
    });

    it.each(["member", "viewer"] as const)("locates nothing in a project a %s was not granted", async role => {
      const { deploymentSettingRepository, active, otherProject } = await setupOrganizations();
      const caller = await container.resolve(UserRepository).create({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: active.organization.id, userId: caller.id, role });
      const setting = await seedDeploymentSetting({ userId: active.user.id, organizationId: active.organization.id, projectId: otherProject.id });

      expect(await deploymentSettingRepository.findLocation({ userId: caller.id, dseq: setting.dseq })).toBeUndefined();
    });

    it("locates nothing for a billing member", async () => {
      const { deploymentSettingRepository, active } = await setupOrganizations();
      const caller = await container.resolve(UserRepository).create({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: active.organization.id, userId: caller.id, role: "billing" });
      const setting = await seedDeploymentSetting({ userId: active.user.id, organizationId: active.organization.id, projectId: active.project.id });

      expect(await deploymentSettingRepository.findLocation({ userId: caller.id, dseq: setting.dseq })).toBeUndefined();
    });

    it("locates nothing in an organization the user does not belong to, even a deployment the user created", async () => {
      const { deploymentSettingRepository, active, foreignSetting } = await setupOrganizations();

      expect(await deploymentSettingRepository.findLocation({ userId: active.user.id, dseq: foreignSetting.dseq })).toBeUndefined();
    });

    it("locates nothing in a deleted organization", async () => {
      const { deploymentSettingRepository } = await setupOrganizations();
      const { user, organization, project } = await seedOrganizationWithOwner({ deletedAt: new Date() });
      const setting = await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: project.id });

      expect(await deploymentSettingRepository.findLocation({ userId: user.id, dseq: setting.dseq })).toBeUndefined();
    });

    it("locates nothing outside the organization it is held within, even one the user owns", async () => {
      const { deploymentSettingRepository, active } = await setupOrganizations();
      const own = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: active.organization.id, userId: own.user.id, role: "admin" });
      const setting = await seedDeploymentSetting({ userId: own.user.id, organizationId: own.organization.id, projectId: own.project.id });

      const location = await deploymentSettingRepository.findLocation({
        userId: own.user.id,
        dseq: setting.dseq,
        within: { organizationId: active.organization.id }
      });

      expect(location).toBeUndefined();
    });

    it("locates only deployments of the projects it is held within", async () => {
      const { deploymentSettingRepository, active, otherProject } = await setupOrganizations();
      const setting = await seedDeploymentSetting({ userId: active.user.id, organizationId: active.organization.id, projectId: otherProject.id });
      const locate = (projectIds: string[]) =>
        deploymentSettingRepository.findLocation({
          userId: active.user.id,
          dseq: setting.dseq,
          within: { organizationId: active.organization.id, projectIds }
        });

      expect(await locate([active.project.id])).toBeUndefined();
      expect(await locate([])).toBeUndefined();
      expect(await locate([otherProject.id])).toEqual({
        organizationId: active.organization.id,
        organizationSlug: active.organization.slug,
        projectId: otherProject.id
      });
    });

    it("prefers the user's own deployment when another organization of theirs holds one under the same dseq", async () => {
      const { deploymentSettingRepository, active, member } = await setupOrganizations();
      const own = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: active.organization.id, userId: own.user.id, role: "admin" });
      const setting = await seedDeploymentSetting({ userId: own.user.id, organizationId: own.organization.id, projectId: own.project.id });
      await seedDeploymentSetting({ userId: member.id, dseq: setting.dseq, organizationId: active.organization.id, projectId: active.project.id });

      expect(await deploymentSettingRepository.findLocation({ userId: own.user.id, dseq: setting.dseq })).toMatchObject({
        organizationId: own.organization.id
      });
    });
  });

  describe("in organization mode", () => {
    it("refuses to overwrite the definition another organization holds under the same dseq and user", async () => {
      const { deploymentSettingRepository, runInOrganization, active, foreignSetting } = await setupOrganizations();

      await expect(
        runInOrganization(active, () =>
          deploymentSettingRepository.upsertDefinition({ userId: foreignSetting.userId, dseq: foreignSetting.dseq, sdl: SDL, manifestVersion: "BBBB" })
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(await deploymentSettingRepository.findById(foreignSetting.id)).toMatchObject({ sdl: null, manifestVersion: null });
    });

    it("refuses to rename a deployment another organization holds under the same dseq and user", async () => {
      const { deploymentSettingRepository, runInOrganization, active, foreignSetting } = await setupOrganizations();

      await expect(
        runInOrganization(active, () =>
          deploymentSettingRepository.upsertName({ userId: foreignSetting.userId, dseq: foreignSetting.dseq, name: "taken over" })
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(await deploymentSettingRepository.findById(foreignSetting.id)).toMatchObject({ name: "theirs" });
    });

    it("records no definition onto a row another organization holds", async () => {
      const { deploymentSettingRepository, runInOrganization, active, foreignSetting } = await setupOrganizations();

      const recorded = await runInOrganization(active, () =>
        deploymentSettingRepository.recordDefinitionIfAbsent({
          userId: foreignSetting.userId,
          dseq: foreignSetting.dseq,
          sdl: SDL,
          manifestVersion: "BBBB",
          sealedSecrets: null,
          closed: false
        })
      );

      expect(recorded).toBeUndefined();
      expect(await deploymentSettingRepository.findById(foreignSetting.id)).toMatchObject({ sdl: null });
    });

    it("leaves another organization's deployment open when marking a deployment closed", async () => {
      const { deploymentSettingRepository, runInOrganization, active, foreignSetting } = await setupOrganizations();

      await runInOrganization(active, () => deploymentSettingRepository.markClosed({ userId: foreignSetting.userId, dseq: foreignSetting.dseq }));

      expect(await deploymentSettingRepository.findById(foreignSetting.id)).toMatchObject({ closed: false });
    });

    it("lets the owner rename a deployment a job recorded for their organization", async () => {
      const { deploymentSettingRepository, runInOrganization, active } = await setupOrganizations();
      const dseq = newDseq();
      await deploymentSettingRepository.createDefaultIfMissing({ userId: active.user.id, dseq, organizationId: active.organization.id });

      const name = await runInOrganization(active, () => deploymentSettingRepository.upsertName({ userId: active.user.id, dseq, name: "renamed" }));

      expect(name).toBe("renamed");
      expect(await deploymentSettingRepository.findOneBy({ userId: active.user.id, dseq })).toMatchObject({
        organizationId: active.organization.id,
        projectId: active.project.id
      });
    });

    it("files a deployment created in a request into the active organization's default project", async () => {
      const { deploymentSettingRepository, runInOrganization, active } = await setupOrganizations();
      const dseq = newDseq();

      await runInOrganization(active, () => deploymentSettingRepository.upsertDefinition({ userId: active.user.id, dseq, sdl: SDL, manifestVersion: "AAAA" }));

      expect(await deploymentSettingRepository.findOneBy({ userId: active.user.id, dseq })).toMatchObject({
        organizationId: active.organization.id,
        projectId: active.project.id
      });
    });

    it("renames a deployment inside the member's project scope", async () => {
      const { deploymentSettingRepository, runAsMember, member, active } = await setupOrganizations();
      const setting = await seedDeploymentSetting({ userId: member.id, organizationId: active.organization.id, projectId: active.project.id });

      const name = await runAsMember(ability =>
        deploymentSettingRepository.accessibleBy(ability, "update").upsertName({ userId: member.id, dseq: setting.dseq, name: "renamed" })
      );

      expect(name).toBe("renamed");
    });

    it("refuses to rename a deployment outside the member's project scope", async () => {
      const { deploymentSettingRepository, runAsMember, member, active, otherProject } = await setupOrganizations();
      const setting = await seedDeploymentSetting({ userId: member.id, organizationId: active.organization.id, projectId: otherProject.id, name: "kept" });

      await expect(
        runAsMember(ability =>
          deploymentSettingRepository.accessibleBy(ability, "update").upsertName({ userId: member.id, dseq: setting.dseq, name: "renamed" })
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(await deploymentSettingRepository.findById(setting.id)).toMatchObject({ name: "kept" });
    });

    it("refuses to create a row in a project the member's scope does not cover and writes nothing", async () => {
      const { deploymentSettingRepository, runAsMember, member, otherProject } = await setupOrganizations();
      const dseq = newDseq();

      await expect(
        runAsMember(
          ability => deploymentSettingRepository.accessibleBy(ability, "update").upsertName({ userId: member.id, dseq, name: "renamed" }),
          [otherProject.id]
        )
      ).rejects.toThrow(ForbiddenError);
      expect(await deploymentSettingRepository.findOneBy({ userId: member.id, dseq })).toBeUndefined();
    });
  });

  describe("recordDefinitionIfAbsent", () => {
    it("records the definition of a running deployment the console holds no row for, funded like any other", async () => {
      const { deploymentSettingRepository, user, sealedToken } = await setup();
      const dseq = newDseq();

      const recorded = await deploymentSettingRepository.recordDefinitionIfAbsent({
        userId: user.id,
        dseq,
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: sealedToken,
        closed: false
      });

      expect(recorded).toEqual(expect.any(String));
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: sealedToken,
        closed: false,
        autoTopUpEnabled: true
      });
    });

    it("records a closed deployment on a row marked closed, with funding off", async () => {
      const { deploymentSettingRepository, user } = await setup();
      const dseq = newDseq();

      await deploymentSettingRepository.recordDefinitionIfAbsent({
        userId: user.id,
        dseq,
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: null,
        closed: true
      });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: SDL, closed: true, autoTopUpEnabled: false });
    });

    it("fills a row that holds no definition, keeping every choice its writer made", async () => {
      const { deploymentSettingRepository, user, sealedToken } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: false, name: "web" });

      const recorded = await deploymentSettingRepository.recordDefinitionIfAbsent({
        userId: user.id,
        dseq,
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: sealedToken,
        closed: true
      });

      expect(recorded).toEqual(expect.any(String));
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: sealedToken,
        name: "web",
        autoTopUpEnabled: false,
        closed: false
      });
    });

    it("leaves a row that already holds a definition untouched, recording nothing", async () => {
      const { deploymentSettingRepository, user, readDefinition, sealedToken, otherSealedToken } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({
        userId: user.id,
        dseq,
        sdl: "version: '2.1'",
        manifestVersion: "BBBB",
        sealedSecrets: otherSealedToken
      });
      const before = await readDefinition(dseq);

      const recorded = await deploymentSettingRepository.recordDefinitionIfAbsent({
        userId: user.id,
        dseq,
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: sealedToken,
        closed: false
      });

      expect(recorded).toBeUndefined();
      expect(await readDefinition(dseq)).toEqual(before);
    });

    it("records only the caller's own row when another user holds the same dseq", async () => {
      const { deploymentSettingRepository, user, trialUser } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.upsertDefinition({ userId: trialUser.id, dseq, sdl: "version: '2.1'", manifestVersion: "BBBB" });

      await deploymentSettingRepository.recordDefinitionIfAbsent({
        userId: user.id,
        dseq,
        sdl: SDL,
        manifestVersion: "AAAA",
        sealedSecrets: null,
        closed: false
      });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: SDL, manifestVersion: "AAAA" });
      expect(await deploymentSettingRepository.findOneBy({ userId: trialUser.id, dseq })).toMatchObject({ sdl: "version: '2.1'", manifestVersion: "BBBB" });
    });

    it("writes nothing through an ability that does not cover the caller's rows", async () => {
      const { deploymentSettingRepository, user, userRepository, abilityFor } = await setup();
      const dseq = newDseq();
      const otherUser = await userRepository.create({ userId: faker.string.uuid() });

      await expect(
        deploymentSettingRepository
          .accessibleBy(abilityFor(otherUser), "update")
          .recordDefinitionIfAbsent({ userId: user.id, dseq, sdl: SDL, manifestVersion: "AAAA", sealedSecrets: null, closed: false })
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toBeUndefined();
    });

    it("records through the caller's own ability", async () => {
      const { deploymentSettingRepository, user, abilityFor } = await setup();
      const dseq = newDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true });

      const recorded = await deploymentSettingRepository
        .accessibleBy(abilityFor(user), "update")
        .recordDefinitionIfAbsent({ userId: user.id, dseq, sdl: SDL, manifestVersion: "AAAA", sealedSecrets: null, closed: false });

      expect(recorded).toEqual(expect.any(String));
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: SDL, manifestVersion: "AAAA" });
    });
  });

  describe("re-sealing one user's stored secrets", () => {
    it("pages only the user's deployments that hold a secret, with the deployment each token is bound to", async () => {
      const { deploymentSettingRepository, seedSecretsOwner } = await setupSecretsOwners();
      const owner = await seedSecretsOwner([
        { dseq: "100", token: newSealedToken() },
        { dseq: "200", token: newSealedToken() },
        { dseq: "300", token: null }
      ]);
      await seedSecretsOwner([{ dseq: "900", token: newSealedToken() }]);
      const paged: Array<{ dseq: string; sealedSecrets: string }> = [];

      for await (const batch of deploymentSettingRepository.findStoredSecretsByUserIteratively({ userId: owner.id, batchSize: 1 })) {
        expect(batch.length).toBeLessThanOrEqual(1);
        paged.push(...batch);
      }

      expect(paged.map(row => row.dseq).sort()).toEqual(["100", "200"]);
      expect(paged.every(row => typeof row.sealedSecrets === "string")).toBe(true);
    });

    it("re-seals a token it read unchanged and moves the row's timestamp", async () => {
      const { deploymentSettingRepository, seedSecretsOwner, backdateUpdatedAt } = await setupSecretsOwners();
      const token = newSealedToken();
      const resealed = newSealedToken();
      const owner = await seedSecretsOwner([{ dseq: "100", token }]);
      const [row] = await deploymentSettingRepository.find({ userId: owner.id });
      await backdateUpdatedAt(row.id);
      const before = (await deploymentSettingRepository.findById(row.id))!;

      expect(await deploymentSettingRepository.resealIfUnchanged(row.id, token, resealed)).toBe(true);

      const after = (await deploymentSettingRepository.findById(row.id))!;
      expect(after.sealedSecrets).toBe(resealed);
      expect(new Date(after.updatedAt!).getTime()).toBeGreaterThan(new Date(before.updatedAt!).getTime());
    });

    it("leaves a row whose token the user replaced in between as the user wrote it", async () => {
      const { deploymentSettingRepository, seedSecretsOwner } = await setupSecretsOwners();
      const token = newSealedToken();
      const owner = await seedSecretsOwner([{ dseq: "100", token }]);
      const [row] = await deploymentSettingRepository.find({ userId: owner.id });
      const userWrote = newSealedToken();
      await deploymentSettingRepository.updateById(row.id, { sealedSecrets: userWrote });

      expect(await deploymentSettingRepository.resealIfUnchanged(row.id, token, newSealedToken())).toBe(false);

      expect((await deploymentSettingRepository.findById(row.id))!.sealedSecrets).toBe(userWrote);
    });

    async function setupSecretsOwners() {
      const userRepository = container.resolve(UserRepository);
      const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      const deploymentSettingsTable = resolveTable("DeploymentSettings");

      async function seedSecretsOwner(deployments: Array<{ dseq: string; token: string | null }>) {
        const owner = await userRepository.create({ userId: faker.string.uuid() });

        for (const { dseq, token } of deployments) {
          await deploymentSettingRepository.create({ userId: owner.id, dseq, autoTopUpEnabled: false, sealedSecrets: token });
        }

        return owner;
      }

      async function backdateUpdatedAt(id: string) {
        await db
          .update(deploymentSettingsTable)
          .set({ updatedAt: sql`now() - interval '1 hour'` })
          .where(eq(deploymentSettingsTable.id, id));
      }

      return { deploymentSettingRepository, seedSecretsOwner, backdateUpdatedAt };
    }
  });

  async function setupOrganizations() {
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);
    const [active, foreign] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
    const member = await container.resolve(UserRepository).create({ userId: faker.string.uuid() });
    await seedOrganizationMember({ organizationId: active.organization.id, userId: member.id, role: "member" });
    const otherProject = await seedProject({ organizationId: active.organization.id });
    const foreignSetting = await seedDeploymentSetting({
      userId: active.user.id,
      organizationId: foreign.organization.id,
      projectId: foreign.project.id,
      name: "theirs"
    });

    function runInOrganization<R>(tenant: { organization: { id: string } }, run: () => Promise<R>) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: tenant.organization.id }));
        return await run();
      });
    }

    function runAsMember<R>(run: (ability: ReturnType<AbilityService["getAbilityFor"]>) => Promise<R>, projectIds = [active.project.id]) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set(
          "ORGANIZATION_CONTEXT",
          createOrganizationContext({
            organizationId: active.organization.id,
            role: "member",
            projectScope: { kind: "projects", projectIds }
          })
        );
        return await run(abilityService.getAbilityFor("REGULAR_USER", member));
      });
    }

    return { deploymentSettingRepository, runInOrganization, runAsMember, active, member, otherProject, foreignSetting };
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
      const address = createAkashAddress();
      const [wallet] = await db
        .insert(userWalletsTable)
        .values({ userId, address, deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing })
        .returning({ id: userWalletsTable.id });

      return { address, walletId: wallet.id };
    }

    const wallet = await createWallet(user.id, false);
    const trialWallet = await createWallet(trialUser.id, true);

    function abilityFor(owner: UserOutput) {
      return abilityService.getAbilityFor("REGULAR_USER", owner);
    }

    async function createDefinition({ manifestVersion, sealedSecrets = null }: { manifestVersion: string; sealedSecrets?: string | null }) {
      const dseq = faker.number.int({ min: 100000, max: 999999 }).toString();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion, sealedSecrets });

      return dseq;
    }

    async function readDefinition(dseq: string) {
      const [row] = await db
        .select({
          sdl: deploymentSettingsTable.sdl,
          manifestVersion: deploymentSettingsTable.manifestVersion,
          sealedSecrets: deploymentSettingsTable.sealedSecrets
        })
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, user.id), eq(deploymentSettingsTable.dseq, dseq)));

      return row;
    }

    async function readGpuReadings(userId: string, dseq: string) {
      const [row] = await db
        .select({ detectedGpus: deploymentSettingsTable.detectedGpus })
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));

      return row.detectedGpus;
    }

    async function readGpuOffers(userId: string, dseq: string) {
      const [row] = await db
        .select({ offeredGpus: deploymentSettingsTable.offeredGpus })
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));

      return row.offeredGpus;
    }

    async function readSettingDseq(id: string) {
      const [row] = await db.select({ dseq: deploymentSettingsTable.dseq }).from(deploymentSettingsTable).where(eq(deploymentSettingsTable.id, id));

      return row.dseq;
    }

    async function createSetting(userId: string = user.id) {
      const setting = await deploymentSettingRepository.create({
        userId,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        autoTopUpEnabled: true
      });
      return setting.id;
    }

    async function createSettingWithSecrets(sealedSecrets: string) {
      const setting = await deploymentSettingRepository.create({ userId: user.id, dseq: newDseq(), autoTopUpEnabled: true, sealedSecrets });

      return setting.id;
    }

    async function findStoredSecrets(ids: string[], batchSize = 1000) {
      const stored = [];

      for await (const batch of deploymentSettingRepository.findStoredSecretsIteratively({ batchSize })) {
        stored.push(...batch.filter(row => ids.includes(row.id)));
      }

      return stored;
    }

    async function findOpenDeployments(addresses?: string[], batchSize = 1000) {
      const open = [];

      for await (const batch of deploymentSettingRepository.findOpenDeploymentsIteratively({ batchSize })) {
        open.push(...batch.filter(deployment => !addresses || addresses.includes(deployment.address)));
      }

      return open;
    }

    async function findAutoTopUpOwners(addresses: string[]) {
      const owners = [];

      for await (const owner of deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively()) {
        if (addresses.includes(owner.address)) {
          owners.push(owner);
        }
      }

      return owners;
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

    async function readClosed(id: string) {
      const [row] = await db.select({ closed: deploymentSettingsTable.closed }).from(deploymentSettingsTable).where(eq(deploymentSettingsTable.id, id));

      return row.closed;
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
      db,
      deploymentSettingsTable,
      userWalletsTable,
      user,
      trialUser,
      wallet,
      trialWallet,
      settingId,
      sealedToken: newSealedToken(),
      otherSealedToken: newSealedToken(),
      abilityFor,
      createDefinition,
      readDefinition,
      readGpuOffers,
      readGpuReadings,
      readSettingDseq,
      createSetting,
      createSettingWithSecrets,
      findStoredSecrets,
      createLimitedSetting,
      createAnchoredSetting,
      findAutoTopUpOwners,
      findOpenDeployments,
      backdateLastFundedAt,
      readClosed
    };
  }
});
