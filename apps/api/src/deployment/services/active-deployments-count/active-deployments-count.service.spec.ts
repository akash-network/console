import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { ActiveDeploymentsCountService } from "./active-deployments-count.service";

import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(ActiveDeploymentsCountService.name, () => {
  it("returns active deployments count when user has wallet", async () => {
    const user = UserSeeder.create();
    const activeCount = faker.number.int({ min: 0, max: 10 });

    const userWallet = UserWalletSeeder.create();
    const { service, userWalletRepository, deploymentRepository } = setup({
      findOneByUserId: jest.fn().mockResolvedValue(userWallet),
      countActiveByOwner: jest.fn().mockResolvedValue(activeCount)
    });

    const result = await service.resolve(user);

    expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
    expect(deploymentRepository.countActiveByOwner).toHaveBeenCalledWith(userWallet.address);
    expect(result).toBe(activeCount);
  });

  it("throws error when user has no wallet", async () => {
    const user = UserSeeder.create();

    const { service, userWalletRepository, logger } = setup({
      findOneByUserId: jest.fn().mockResolvedValue(null)
    });

    await expect(service.resolve(user)).rejects.toThrow("User wallet not found");

    expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
    expect(logger.warn).toHaveBeenCalledWith({
      userId: user.id,
      event: "NO_WALLET_ADDRESS"
    });
  });

  it("throws error when user wallet has no address", async () => {
    const user = UserSeeder.create();

    const userWallet = UserWalletSeeder.create({ address: null });
    const { service, userWalletRepository, logger } = setup({
      findOneByUserId: jest.fn().mockResolvedValue(userWallet)
    });

    await expect(service.resolve(user)).rejects.toThrow("User wallet not found");

    expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
    expect(logger.warn).toHaveBeenCalledWith({
      userId: user.id,
      event: "NO_WALLET_ADDRESS"
    });
  });

  function setup(input?: { findOneByUserId?: UserWalletRepository["findOneByUserId"]; countActiveByOwner?: DeploymentRepository["countActiveByOwner"] }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        findOneByUserId: input?.findOneByUserId ?? jest.fn()
      }),
      deploymentRepository: mock<DeploymentRepository>({
        countActiveByOwner: input?.countActiveByOwner ?? jest.fn()
      }),
      logger: mock<LoggerService>()
    };

    const service = new ActiveDeploymentsCountService(mocks.deploymentRepository, mocks.userWalletRepository, mocks.logger);

    return { service, ...mocks };
  }
});
