import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { DeploymentSettingRepository } from "./deployment-setting.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

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

  describe("findAutoTopUpDeploymentsByOwner", () => {
    it("includes a deployment whose owner never configured auto top-up", async () => {
      const { createUserWithWallet, createSettingFor, deploymentSettingRepository } = await setup();
      const { user, address } = await createUserWithWallet();
      const setting = await createSettingFor(user.id, { autoTopUpEnabled: null });

      const deployments = await deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);

      expect(deployments.map(deployment => deployment.dseq)).toContain(setting.dseq);
    });

    it("excludes a deployment whose owner explicitly disabled auto top-up", async () => {
      const { createUserWithWallet, createSettingFor, deploymentSettingRepository } = await setup();
      const { user, address } = await createUserWithWallet();
      const setting = await createSettingFor(user.id, { autoTopUpEnabled: false });

      const deployments = await deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);

      expect(deployments.map(deployment => deployment.dseq)).not.toContain(setting.dseq);
    });

    it("excludes an unconfigured deployment that is already marked closed", async () => {
      const { createUserWithWallet, createSettingFor, deploymentSettingRepository } = await setup();
      const { user, address } = await createUserWithWallet();
      const setting = await createSettingFor(user.id, { autoTopUpEnabled: null, closed: true });

      const deployments = await deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);

      expect(deployments.map(deployment => deployment.dseq)).not.toContain(setting.dseq);
    });
  });

  describe("findAutoTopUpDeploymentsByOwnerIteratively", () => {
    it("yields unconfigured deployments only for owners that have a managed wallet", async () => {
      const { userRepository, createUserWithWallet, createSettingFor, deploymentSettingRepository } = await setup();
      const { user: walletOwner } = await createUserWithWallet();
      const walletOwnerSetting = await createSettingFor(walletOwner.id, { autoTopUpEnabled: null });
      const walletLessUser = await userRepository.create({ userId: faker.string.uuid() });
      const walletLessSetting = await createSettingFor(walletLessUser.id, { autoTopUpEnabled: null });

      const yieldedDseqs: string[] = [];
      for await (const batch of deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively()) {
        yieldedDseqs.push(...batch.deploymentSettings.map(deployment => deployment.dseq));
      }

      expect(yieldedDseqs).toContain(walletOwnerSetting.dseq);
      expect(yieldedDseqs).not.toContain(walletLessSetting.dseq);
    });
  });

  async function setup() {
    const userRepository = container.resolve(UserRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userWalletsTable = resolveTable("UserWallets");
    const user = await userRepository.create({ userId: faker.string.uuid() });

    async function createUserWithWallet() {
      const owner = await userRepository.create({ userId: faker.string.uuid() });
      const address = createAkashAddress();
      await db.insert(userWalletsTable).values({ userId: owner.id, address, deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false });

      return { user: owner, address };
    }

    async function createSettingFor(userId: string, overrides: { autoTopUpEnabled: boolean | null; closed?: boolean }) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId,
          dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
          autoTopUpEnabled: overrides.autoTopUpEnabled,
          closed: overrides.closed ?? false
        })
        .returning();

      return setting;
    }

    async function createSetting() {
      const setting = await deploymentSettingRepository.create({
        userId: user.id,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        autoTopUpEnabled: true
      });
      return setting.id;
    }

    async function backdateLastFundedAt(id: string, minutesAgo: number) {
      await db
        .update(deploymentSettingsTable)
        .set({ lastFundedAt: sql`now() - (${minutesAgo} * interval '1 minute')` })
        .where(eq(deploymentSettingsTable.id, id));
    }

    const settingId = await createSetting();

    return { userRepository, deploymentSettingRepository, user, settingId, createSetting, createUserWithWallet, createSettingFor, backdateLastFundedAt };
  }
});
