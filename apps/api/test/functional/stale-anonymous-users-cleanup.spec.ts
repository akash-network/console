import { AuthzHttpService } from "@akashnetwork/http-sdk";
import subDays from "date-fns/subDays";
import { container } from "tsyringe";

import { app } from "@src/app";
import { resolveWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletRepository } from "@src/billing/repositories";
import { UserController } from "@src/user/controllers/user/user.controller";
import { UserRepository } from "@src/user/repositories";

import { DbTestingService } from "@test/services/db-testing.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(100000);

describe("Users", () => {
  const dbService = container.resolve(DbTestingService);
  const userRepository = container.resolve(UserRepository);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const walletService = new WalletTestingService(app);
  const controller = container.resolve(UserController);
  const authzHttpService = container.resolve(AuthzHttpService);
  const masterWalletService = resolveWallet("MANAGED");
  let masterAddress: string;

  beforeAll(async () => {
    masterAddress = await masterWalletService.getFirstAddress();
  });

  afterEach(async () => {
    await dbService.cleanAll();
  });

  describe("stale anonymous users cleanup", () => {
    it("should remove anonymous users inactive for defined period", async () => {
      const [reactivated, recent, invalidAddress, staleNoWallet, recentNoWallet, ...staleUsers] = await Promise.all([
        walletService.createUserAndWallet(),
        walletService.createUserAndWallet(),
        walletService.createUserAndWallet(),
        walletService.createUser(),
        walletService.createUser(),
        ...Array.from({ length: 10 }).map(() => walletService.createUserAndWallet())
      ]);

      const staleParams = { lastActiveAt: subDays(new Date(), 91) };
      await Promise.all([
        ...staleUsers.map(user => userRepository.updateById(user.user.id, staleParams)),
        userRepository.updateById(staleNoWallet.user.id, staleParams),
        userRepository.updateById(reactivated.user.id, staleParams),
        userRepository.updateById(invalidAddress.user.id, staleParams),
        userWalletRepository.updateById(invalidAddress.wallet.id, { address: "invalid" })
      ]);

      const reactivate = walletService.getWalletByUserId(reactivated.user.id, reactivated.token);
      await reactivate;

      await controller.cleanUpStaleAnonymousUsers({ dryRun: false, concurrency: 4 });

      const [users, wallets] = await Promise.all([userRepository.find(), userWalletRepository.find()]);

      expect(users).toHaveLength(4);
      expect(wallets).toHaveLength(3);

      expect(users).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({ id: recent.user.id }),
          expect.objectContaining({ id: reactivated.user.id }),
          expect.objectContaining({ id: recentNoWallet.user.id }),
          expect.objectContaining({ id: invalidAddress.user.id })
        ])
      );

      await Promise.all([
        expect(authzHttpService.hasFeeAllowance(recent.wallet.address, masterAddress)).resolves.toBeFalsy(),
        expect(authzHttpService.hasDepositDeploymentGrant(recent.wallet.address, masterAddress)).resolves.toBeFalsy(),

        expect(authzHttpService.hasValidFeeAllowance(reactivated.wallet.address, masterAddress)).resolves.toBeFalsy(),
        expect(authzHttpService.hasDepositDeploymentGrant(reactivated.wallet.address, masterAddress)).resolves.toBeFalsy(),

        ...staleUsers
          .map(user => [
            expect(authzHttpService.hasFeeAllowance(user.wallet.address, masterAddress)).resolves.toBeFalsy(),
            expect(authzHttpService.hasDepositDeploymentGrant(user.wallet.address, masterAddress)).resolves.toBeFalsy()
          ])
          .flat()
      ]);
    });
  });
});
