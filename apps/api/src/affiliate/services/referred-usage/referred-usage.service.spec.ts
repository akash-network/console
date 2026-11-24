import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { DeploymentConsumption, DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { ReferredUsageService } from "./referred-usage.service";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(ReferredUsageService.name, () => {
  describe("hasConsumedAtLeast", () => {
    it("sums settled and accrued spend across the wallets of every organization the referred user created", async () => {
      const { service, referredUserId, wallets, deploymentSpendRepository } = setup({
        organizationCount: 2,
        consumption: [
          { settledMicroUsd: "12000000", accruedMicroUsd: "3000000" },
          { settledMicroUsd: "4000000", accruedMicroUsd: "1000000" }
        ]
      });

      await expect(
        service.hasConsumedAtLeast(referredUserId, { since: new Date("2026-08-10T23:30:00.000Z"), until: new Date("2026-11-09T22:00:00.000Z") }, 2000)
      ).resolves.toBe(true);

      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith({
        owners: wallets.map(({ address }) => address),
        startDate: "2026-08-10",
        endDate: "2026-11-09"
      });
    });

    it("finds the organizations the referred user created", async () => {
      const { service, referredUserId, organizationRepository } = setup({ organizationCount: 1, consumption: [] });

      await service.hasConsumedAtLeast(referredUserId, { since: new Date(), until: new Date() }, 2000);

      expect(organizationRepository.find).toHaveBeenCalledWith({ createdByUserId: referredUserId });
    });

    it("returns false when the spend falls one cent short of the minimum", async () => {
      const { service, referredUserId } = setup({
        organizationCount: 1,
        consumption: [{ settledMicroUsd: "19980000", accruedMicroUsd: "10000" }]
      });

      await expect(service.hasConsumedAtLeast(referredUserId, { since: new Date(), until: new Date() }, 2000)).resolves.toBe(false);
    });

    it("ignores an organization without a wallet", async () => {
      const { service, referredUserId, wallets, deploymentSpendRepository } = setup({
        organizationCount: 2,
        walletlessOrganizationCount: 1,
        consumption: [{ settledMicroUsd: "20000000", accruedMicroUsd: "0" }]
      });

      await expect(service.hasConsumedAtLeast(referredUserId, { since: new Date(), until: new Date() }, 2000)).resolves.toBe(true);

      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith(
        expect.objectContaining({ owners: wallets.map(({ address }) => address) })
      );
    });

    it("returns false without reading the chain when no payer organization has a wallet", async () => {
      const { service, referredUserId, deploymentSpendRepository } = setup({ organizationCount: 0, walletlessOrganizationCount: 1, consumption: [] });

      await expect(service.hasConsumedAtLeast(referredUserId, { since: new Date(), until: new Date() }, 0)).resolves.toBe(false);

      expect(deploymentSpendRepository.findConsumedByDeployment).not.toHaveBeenCalled();
    });
  });

  describe("isIndexedThroughUtcDayOf", () => {
    it.each([
      { case: "a block of the next UTC day is processed", latestProcessedBlockTime: new Date("2026-07-16T00:00:00.000Z"), isIndexed: true },
      { case: "only the day's last block is processed", latestProcessedBlockTime: new Date("2026-07-15T23:59:59.999Z"), isIndexed: false },
      {
        case: "the index is processed just past the time but not the rest of its day",
        latestProcessedBlockTime: new Date("2026-07-15T10:00:06.000Z"),
        isIndexed: false
      },
      { case: "no block is processed", latestProcessedBlockTime: undefined, isIndexed: false }
    ])("returns $isIndexed when $case", async ({ latestProcessedBlockTime, isIndexed }) => {
      const { service, deploymentSpendRepository } = setup({ organizationCount: 0, consumption: [] });
      deploymentSpendRepository.findLatestProcessedBlockTime.mockResolvedValue(latestProcessedBlockTime);

      await expect(service.isIndexedThroughUtcDayOf(new Date("2026-07-15T10:00:00.000Z"))).resolves.toBe(isIndexed);
    });

    it("returns false while a block of the next day is stored but not yet processed", async () => {
      const { service, deploymentSpendRepository } = setup({ organizationCount: 0, consumption: [] });
      deploymentSpendRepository.findLatestBlockTime.mockResolvedValue(new Date("2026-07-16T00:00:06.000Z"));
      deploymentSpendRepository.findLatestProcessedBlockTime.mockResolvedValue(new Date("2026-07-15T23:59:54.000Z"));

      await expect(service.isIndexedThroughUtcDayOf(new Date("2026-07-15T10:00:00.000Z"))).resolves.toBe(false);
    });
  });

  function setup(input: {
    organizationCount: number;
    walletlessOrganizationCount?: number;
    consumption: Array<Pick<DeploymentConsumption, "settledMicroUsd" | "accruedMicroUsd">>;
  }) {
    const referredUserId = faker.string.uuid();
    const organizations = Array.from({ length: input.organizationCount }, () => createOrganization({ createdByUserId: referredUserId }));
    const walletlessOrganizations = Array.from({ length: input.walletlessOrganizationCount ?? 0 }, () =>
      createOrganization({ createdByUserId: referredUserId })
    );
    const wallets = organizations.map(({ id }) => createUserWallet({ organizationId: id }));

    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.find.mockResolvedValue([...organizations, ...walletlessOrganizations]);

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByOrganizationId.mockImplementation(async organizationId => wallets.find(wallet => wallet.organizationId === organizationId));

    const deploymentSpendRepository = mock<DeploymentSpendRepository>();
    deploymentSpendRepository.findConsumedByDeployment.mockResolvedValue(
      input.consumption.map(spend => ({ owner: wallets[0]?.address ?? "", dseq: faker.string.numeric(6), ...spend }))
    );

    const service = new ReferredUsageService(organizationRepository, userWalletRepository, deploymentSpendRepository);

    return { service, referredUserId, wallets, organizationRepository, userWalletRepository, deploymentSpendRepository };
  }
});
