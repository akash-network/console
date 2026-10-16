import { faker } from "@faker-js/faker";
import { Op } from "sequelize";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { DeploymentSpendRepository } from "./deployment-spend.repository";

import { createAkashAddress, createDay, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

describe(DeploymentSpendRepository.name, () => {
  describe("findDailyConsumption", () => {
    it("prices an AKT lease at the day's AKT price and counts its hours at the average block time when the day's blocks are not indexed", async () => {
      const { repository, owner, seedDay, seedLease } = setup();
      await seedDay({ date: "2031-05-01", firstBlockHeight: 7_000_000, lastBlockHeightYet: 7_000_600, aktPrice: 2 });
      const dseq = await seedLease({ owner, createdHeight: 6_999_000, closedHeight: 7_000_300, price: 1000, denom: "uakt" });

      const consumption = await repository.findDailyConsumption({ owners: [owner], startDate: "2031-05-01", endDate: "2031-05-01" });

      expect(consumption).toEqual([{ dseq, date: "2031-05-01", consumedMicroUsd: "600000", hours: 0.5 }]);
    });

    it("reads nothing for no owner", async () => {
      const { repository } = setup();

      expect(await repository.findDailyConsumption({ owners: [], startDate: "2031-05-01", endDate: "2031-05-01" })).toEqual([]);
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

    const seedLease = async (input: { owner: string; createdHeight: number; closedHeight: number; price: number; denom: string }) => {
      const dseq = faker.string.numeric(12);
      const provider = await createProvider({ deletedHeight: null });
      const deployment = await createDeployment({ owner: input.owner, dseq, denom: input.denom });
      const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: input.owner, dseq });
      const lease = await createLease({ ...input, dseq, providerAddress: provider.owner, deploymentId: deployment.id, deploymentGroupId: group.id });
      onTestFinished(async () => {
        await chainDb.models.lease.destroy({ where: { id: { [Op.eq]: lease.id } } });
        await chainDb.models.deploymentGroup.destroy({ where: { id: { [Op.eq]: group.id } } });
        await chainDb.models.deployment.destroy({ where: { id: { [Op.eq]: deployment.id } } });
        await chainDb.models.provider.destroy({ where: { owner: { [Op.eq]: provider.owner } } });
      });

      return dseq;
    };

    return { repository: new DeploymentSpendRepository(chainDb), owner: createAkashAddress(), seedDay, seedLease };
  }
});
