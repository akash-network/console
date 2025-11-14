import { mock } from "jest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import { RemainingCreditsService } from "./remaining-credits.service";

import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(RemainingCreditsService.name, () => {
  it("returns remaining credits when user has wallet", async () => {
    const user = UserSeeder.create();
    const remainingCreditsInUusdc = 100_000_000;
    const expectedCreditsInUsdc = 100;

    const userWallet = UserWalletSeeder.create();
    const { service, userWalletRepository, balanceService } = setup({
      findOneByUserId: jest.fn().mockResolvedValue(userWallet),
      retrieveDeploymentLimit: jest.fn().mockResolvedValue(remainingCreditsInUusdc)
    });

    const result = await service.resolve(user);

    expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
    expect(balanceService.retrieveDeploymentLimit).toHaveBeenCalledWith(userWallet);
    expect(result).toBe(expectedCreditsInUsdc);
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

  function setup(input?: { findOneByUserId?: UserWalletRepository["findOneByUserId"]; retrieveDeploymentLimit?: BalancesService["retrieveDeploymentLimit"] }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        findOneByUserId: input?.findOneByUserId ?? jest.fn()
      }),
      balanceService: mock<BalancesService>({
        retrieveDeploymentLimit: input?.retrieveDeploymentLimit ?? jest.fn()
      }),
      logger: mock<LoggerService>()
    };

    const service = new RemainingCreditsService(mocks.balanceService, mocks.userWalletRepository, mocks.logger);

    return { service, ...mocks };
  }
});
