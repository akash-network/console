import "@test/setup-functional-tests";

import type { Deployment, DeploymentGroup, Lease, Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { Block, Day } from "@akashnetwork/database/dbSchemas/base";
import type { CreationAttributes } from "sequelize";
import { Op } from "sequelize";

import { chainDb } from "@src/db/dbConnection";
import { UsageRepository } from "./usage.repository";

import { createAkashAddress, createAkashBlock, createDay, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

describe(UsageRepository.name, () => {
  describe("getHistory", () => {
    const testAddress = createAkashAddress();
    let createdDayIds: string[] = [];
    let createdLeaseIds: string[] = [];
    let createdBlockHeights: number[] = [];
    let createdDeploymentIds: string[] = [];
    let createdDeploymentGroupIds: string[] = [];
    let createdProviderAddresses: string[] = [];

    afterEach(async () => {
      await chainDb.models.lease.destroy({
        where: {
          id: { [Op.in]: createdLeaseIds }
        }
      });

      await chainDb.models.deploymentGroup.destroy({
        where: {
          id: { [Op.in]: createdDeploymentGroupIds }
        }
      });

      await chainDb.models.deployment.destroy({
        where: {
          id: { [Op.in]: createdDeploymentIds }
        }
      });

      await chainDb.models.provider.destroy({
        where: {
          owner: { [Op.in]: createdProviderAddresses }
        }
      });

      await chainDb.models.block.destroy({
        where: {
          height: { [Op.in]: createdBlockHeights }
        }
      });

      await chainDb.models.day.destroy({
        where: {
          id: { [Op.in]: createdDayIds }
        }
      });

      createdDayIds = [];
      createdLeaseIds = [];
      createdBlockHeights = [];
      createdDeploymentIds = [];
      createdDeploymentGroupIds = [];
      createdProviderAddresses = [];
    });

    it("returns usage history for date range with no leases", async () => {
      const { usageRepository } = setup();
      const startDate = "2023-01-01";
      const endDate = "2023-01-03";

      const results = await usageRepository.getHistory(testAddress, startDate, endDate);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        date: startDate,
        activeDeployments: 0,
        dailyAktSpent: 0,
        totalAktSpent: 0,
        dailyUsdcSpent: 0,
        totalUsdcSpent: 0,
        dailyUsdSpent: 0,
        totalUsdSpent: 0
      });
    });

    it("calculates usage for active leases with AKT denomination", async () => {
      const { usageRepository } = setup();
      const startDate = "2023-01-01";
      const endDate = "2023-01-02";

      await createTestDay({
        date: new Date("2023-01-01"),
        firstBlockHeight: 100,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 2.5
      });

      await createTestDay({
        date: new Date("2023-01-02"),
        firstBlockHeight: 200,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300,
        aktPrice: 2.75
      });

      await createTestBlock({ height: 50 });
      await createTestBlock({ height: 150 });
      await createTestBlock({ height: 250 });
      await createTestBlock({ height: 350 });

      await createTestLease({
        owner: testAddress,
        createdHeight: 50,
        closedHeight: 350,
        price: 1_000_000,
        denom: "uakt"
      });

      const results = await usageRepository.getHistory(testAddress, startDate, endDate);

      expect(results).toHaveLength(2);

      expect(results[0]).toMatchObject({
        date: "2023-01-01",
        activeDeployments: 1,
        dailyAktSpent: 100,
        totalAktSpent: 100,
        dailyUsdSpent: 250,
        totalUsdSpent: 250
      });

      expect(results[1]).toMatchObject({
        date: "2023-01-02",
        activeDeployments: 1,
        dailyAktSpent: 100,
        totalAktSpent: 200,
        dailyUsdSpent: 275,
        totalUsdSpent: 525
      });
    });

    it("calculates usage for active leases with USDC denomination", async () => {
      const { usageRepository } = setup();
      const startDate = "2023-01-01";
      const endDate = "2023-01-01";

      await createTestDay({
        date: new Date("2023-01-01"),
        firstBlockHeight: 100,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 2.5
      });

      await createTestBlock({ height: 150 });

      await createTestLease({
        owner: testAddress,
        createdHeight: 50,
        closedHeight: 250,
        price: 500_000,
        denom: "uusdc"
      });

      const results = await usageRepository.getHistory(testAddress, startDate, endDate);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        date: "2023-01-01",
        activeDeployments: 1,
        dailyAktSpent: 0,
        dailyUsdcSpent: 50,
        totalUsdcSpent: 50,
        dailyUsdSpent: 50,
        totalUsdSpent: 50
      });
    });

    it("handles multiple leases with different denominations", async () => {
      const { usageRepository } = setup();
      const startDate = "2023-01-01";
      const endDate = "2023-01-01";

      await createTestDay({
        date: new Date("2023-01-01"),
        firstBlockHeight: 100,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 3.0
      });

      await createTestBlock({ height: 150 });

      await createTestLease({
        owner: testAddress,
        createdHeight: 50,
        closedHeight: 250,
        price: 2_000_000,
        denom: "uakt"
      });

      await createTestLease({
        owner: testAddress,
        createdHeight: 75,
        closedHeight: 275,
        price: 1_500_000,
        denom: "uusdc"
      });

      const results = await usageRepository.getHistory(testAddress, startDate, endDate);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        date: "2023-01-01",
        activeDeployments: 2,
        dailyAktSpent: 200,
        dailyUsdcSpent: 150,
        dailyUsdSpent: 750
      });
    });

    it("excludes leases from other addresses", async () => {
      const { usageRepository } = setup();
      const otherAddress = createAkashAddress();
      const startDate = "2023-01-01";
      const endDate = "2023-01-01";

      await createTestDay({
        date: new Date("2023-01-01"),
        firstBlockHeight: 100,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 2.5
      });

      await createTestBlock({ height: 150 });

      await createTestLease({
        owner: testAddress,
        createdHeight: 50,
        closedHeight: 250,
        price: 1000000,
        denom: "uakt"
      });

      await createTestLease({
        owner: otherAddress,
        createdHeight: 50,
        closedHeight: 250,
        price: 5000000,
        denom: "uakt"
      });

      const results = await usageRepository.getHistory(testAddress, startDate, endDate);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        activeDeployments: 1,
        dailyAktSpent: 100
      });
    });

    async function createTestDay(overrides: Partial<CreationAttributes<Day>> = {}) {
      const day = await createDay(overrides);
      createdDayIds.push(day.id);
      return day;
    }

    async function createTestBlock(overrides: Partial<CreationAttributes<Block>> = {}) {
      const block = await createAkashBlock(overrides);
      createdBlockHeights.push(block.height);
      return block;
    }

    async function createTestProvider(overrides: Partial<CreationAttributes<Provider>> = {}) {
      const provider = await createProvider(overrides);
      createdProviderAddresses.push(provider.owner);
      return provider;
    }

    async function createTestDeployment(overrides: Partial<CreationAttributes<Deployment>> = {}) {
      const deployment = await createDeployment(overrides);
      createdDeploymentIds.push(deployment.id);
      return deployment;
    }

    async function createTestDeploymentGroup(overrides: Partial<CreationAttributes<DeploymentGroup>> = {}) {
      const deploymentGroup = await createDeploymentGroup(overrides);
      createdDeploymentGroupIds.push(deploymentGroup.id);
      return deploymentGroup;
    }

    async function createTestLease(overrides: Partial<CreationAttributes<Lease>> = {}) {
      const providerAddress = overrides.providerAddress || (await createTestProvider()).owner;
      const deployment = await createTestDeployment({ owner: overrides.owner || testAddress });
      const deploymentGroup = await createTestDeploymentGroup({
        deploymentId: deployment.id,
        owner: overrides.owner || testAddress
      });

      const lease = await createLease({
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        providerAddress,
        ...overrides
      });
      createdLeaseIds.push(lease.id);
      return lease;
    }
  });

  function setup() {
    const usageRepository = new UsageRepository();
    return {
      usageRepository
    };
  }
});
