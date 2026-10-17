import { faker } from "@faker-js/faker";
import { Op } from "sequelize";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { DeploymentSpendRepository } from "./deployment-spend.repository";

import {
  createAkashAddress,
  createDay,
  createDeployment,
  createDeploymentGroup,
  createDeploymentGroupResource,
  createLease,
  createProvider
} from "@test/seeders";

describe(DeploymentSpendRepository.name, () => {
  describe("findDailyConsumption", () => {
    it("prices an AKT lease at the day's AKT price and counts its hours at the average block time when the day's blocks are not indexed", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-05-01", firstBlockHeight: 7_000_000, lastBlockHeightYet: 7_000_600, aktPrice: 2 });
      const dseq = await seedLeases({ owner, denom: "uakt", leases: [{ createdHeight: 6_999_000, closedHeight: 7_000_300, price: 1000 }] });

      const consumption = await repository.findDailyConsumption({ owners: [owner], startDate: "2031-05-01", endDate: "2031-05-01" });

      expect(consumption).toEqual([{ dseq, date: "2031-05-01", consumedMicroUsd: "600000", hours: 0.5 }]);
    });

    it("adds up the hours of a lease closed and replaced the same day", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-05-02", firstBlockHeight: 7_100_000, lastBlockHeightYet: 7_100_600, aktPrice: 2 });
      const dseq = await seedLeases({
        owner,
        denom: "uakt",
        leases: [
          { createdHeight: 7_100_000, closedHeight: 7_100_300, price: 1000 },
          { createdHeight: 7_100_300, closedHeight: 7_100_600, price: 500 }
        ]
      });

      const consumption = await repository.findDailyConsumption({ owners: [owner], startDate: "2031-05-02", endDate: "2031-05-02" });

      expect(consumption).toEqual([{ dseq, date: "2031-05-02", consumedMicroUsd: "900000", hours: 1 }]);
    });

    it("counts the hours two leases of a deployment overlap once", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-05-03", firstBlockHeight: 7_200_000, lastBlockHeightYet: 7_200_600, aktPrice: 2 });
      const dseq = await seedLeases({
        owner,
        denom: "uakt",
        leases: [
          { createdHeight: 7_200_000, closedHeight: 7_200_300, price: 1000 },
          { createdHeight: 7_200_150, closedHeight: 7_200_450, price: 1000 },
          { createdHeight: 7_200_200, closedHeight: 7_200_250, price: 1000 }
        ]
      });

      const consumption = await repository.findDailyConsumption({ owners: [owner], startDate: "2031-05-03", endDate: "2031-05-03" });

      expect(consumption).toEqual([{ dseq, date: "2031-05-03", consumedMicroUsd: "1300000", hours: 0.75 }]);
    });

    it("reads nothing for no owner", async () => {
      const { repository } = setup();

      expect(await repository.findDailyConsumption({ owners: [], startDate: "2031-05-01", endDate: "2031-05-01" })).toEqual([]);
    });
  });

  describe("findGpuUsage", () => {
    it("counts a lease's gpus for each hour it ran in the range", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-06-01", firstBlockHeight: 8_000_000, lastBlockHeightYet: 8_014_400, aktPrice: 2 });
      const dseq = await seedLeases({ owner, denom: "uact", leases: [{ createdHeight: 8_001_000, closedHeight: 8_002_800, price: 1, gpuUnits: 2 }] });

      const usage = await repository.findGpuUsage({ owners: [owner], startDate: "2031-06-01", endDate: "2031-06-01" });

      expect(usage).toEqual([{ dseq, gpuHours: 6, gpuModels: [] }]);
    });

    it("adds up the gpus of leases that ran at the same time and clips a lease to the range", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-06-02", firstBlockHeight: 8_100_000, lastBlockHeightYet: 8_114_400, aktPrice: 2 });
      const dseq = await seedLeases({
        owner,
        denom: "uact",
        leases: [
          { createdHeight: 8_100_000, closedHeight: 8_100_600, price: 1, gpuUnits: 1 },
          { createdHeight: 8_100_000, closedHeight: 8_100_600, price: 1, gpuUnits: 4 },
          { createdHeight: 8_114_100, closedHeight: 8_120_000, price: 1, gpuUnits: 1 }
        ]
      });

      const usage = await repository.findGpuUsage({ owners: [owner], startDate: "2031-06-02", endDate: "2031-06-02" });

      expect(usage).toEqual([{ dseq, gpuHours: 5.5, gpuModels: [] }]);
    });

    it("names each model the deployment's gpu resources asked for once, without their ram or interface", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-06-03", firstBlockHeight: 8_200_000, lastBlockHeightYet: 8_214_400, aktPrice: 2 });
      const dseq = await seedLeases({
        owner,
        denom: "uact",
        leases: [{ createdHeight: 8_200_000, closedHeight: 8_200_600, price: 1, gpuUnits: 3 }],
        resources: [
          { gpuModel: "h100/ram/80Gi/interface/sxm" },
          { gpuModel: "h100" },
          { gpuModel: "a100" },
          { gpuModel: null },
          { gpuModel: "t4", gpuUnits: 0 }
        ]
      });

      const usage = await repository.findGpuUsage({ owners: [owner], startDate: "2031-06-03", endDate: "2031-06-03" });

      expect(usage).toEqual([{ dseq, gpuHours: 3, gpuModels: ["a100", "h100"] }]);
    });

    it("leaves out a deployment whose leases held no gpu", async () => {
      const { repository, owner, seedDay, seedLeases } = setup();
      await seedDay({ date: "2031-06-04", firstBlockHeight: 8_300_000, lastBlockHeightYet: 8_314_400, aktPrice: 2 });
      await seedLeases({ owner, denom: "uact", leases: [{ createdHeight: 8_300_000, closedHeight: 8_300_600, price: 1, gpuUnits: 0 }] });

      expect(await repository.findGpuUsage({ owners: [owner], startDate: "2031-06-04", endDate: "2031-06-04" })).toEqual([]);
    });

    it("reads nothing for no owner", async () => {
      const { repository } = setup();

      expect(await repository.findGpuUsage({ owners: [], startDate: "2031-06-01", endDate: "2031-06-01" })).toEqual([]);
    });
  });

  function setup() {
    const chainDb = container.resolve(CHAIN_DB);

    const seedDay = async (input: { date: string; firstBlockHeight: number; lastBlockHeightYet: number; aktPrice: number }) => {
      const day = await createDay({ ...input, date: new Date(`${input.date}T00:00:00.000Z`), lastBlockHeight: input.lastBlockHeightYet });
      onTestFinished(async () => {
        await chainDb.models.day.destroy({ where: { id: { [Op.eq]: day.id } } });
      });
    };

    const seedLeases = async ({
      owner,
      denom,
      leases,
      resources = []
    }: {
      owner: string;
      denom: string;
      leases: Array<{ createdHeight: number; closedHeight: number; price: number; gpuUnits?: number }>;
      resources?: Array<{ gpuModel: string | null; gpuUnits?: number }>;
    }) => {
      const dseq = faker.string.numeric(12);
      const provider = await createProvider({ deletedHeight: null });
      const deployment = await createDeployment({ owner, dseq, denom });
      const group = await createDeploymentGroup({ deploymentId: deployment.id, owner, dseq });
      await Promise.all(
        resources.map(async ({ gpuModel, gpuUnits = 1 }) => {
          const resource = await createDeploymentGroupResource({ deploymentGroupId: group.id });
          await resource.update({ gpuModel, gpuUnits });
        })
      );
      const created = await Promise.all(
        leases.map((lease, index) =>
          createLease({
            ...lease,
            owner,
            denom,
            dseq,
            oseq: index + 1,
            providerAddress: provider.owner,
            deploymentId: deployment.id,
            deploymentGroupId: group.id
          })
        )
      );
      onTestFinished(async () => {
        await chainDb.models.lease.destroy({ where: { id: { [Op.in]: created.map(({ id }) => id) } } });
        await chainDb.models.deploymentGroupResource.destroy({ where: { deploymentGroupId: { [Op.eq]: group.id } } });
        await chainDb.models.deploymentGroup.destroy({ where: { id: { [Op.eq]: group.id } } });
        await chainDb.models.deployment.destroy({ where: { id: { [Op.eq]: deployment.id } } });
        await chainDb.models.provider.destroy({ where: { owner: { [Op.eq]: provider.owner } } });
      });

      return dseq;
    };

    return { repository: new DeploymentSpendRepository(chainDb), owner: createAkashAddress(), seedDay, seedLeases };
  }
});
