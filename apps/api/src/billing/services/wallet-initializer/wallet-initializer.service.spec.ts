import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "../../repositories/user-wallet/user-wallet.repository";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createChainWallet } from "@test/seeders/chain-wallet.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(WalletInitializerService.name, () => {
  describe("initializeAndGrantTrialLimits", () => {
    it("creates a new wallet and authorizes trial spending when no wallet exists", async () => {
      const userId = "test-user-id";
      const newWallet = UserWalletSeeder.create({ userId });
      const chainWallet = createChainWallet();
      const findWalletByUserId = jest.fn().mockImplementation(async () => null);
      const createWallet = jest.fn().mockImplementation(async () => newWallet);
      const createAndAuthorizeTrialSpending = jest.fn().mockImplementation(async () => chainWallet);
      const updateWalletById = jest.fn().mockImplementation(async () => newWallet);

      const di = setup({
        findWalletByUserId,
        createWallet,
        createAndAuthorizeTrialSpending,
        updateWalletById
      });

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(findWalletByUserId).toHaveBeenCalledWith(userId);
      expect(createWallet).toHaveBeenCalledWith({ userId });
      expect(createAndAuthorizeTrialSpending).toHaveBeenCalledWith({ addressIndex: newWallet.id });
      expect(updateWalletById).toHaveBeenCalledWith(
        newWallet.id,
        {
          address: chainWallet.address,
          deploymentAllowance: chainWallet.limits.deployment,
          feeAllowance: chainWallet.limits.fees
        },
        expect.any(Object)
      );
    });

    it("does not authorizes trial spending for existing wallet", async () => {
      const userId = "test-user-id";
      const existingWallet = UserWalletSeeder.create({ userId });
      const findWalletByUserId = jest.fn().mockResolvedValue(existingWallet);
      const createAndAuthorizeTrialSpending = jest.fn().mockResolvedValue(undefined);
      const createWallet = jest.fn().mockResolvedValue(null);

      const di = setup({
        findWalletByUserId,
        createAndAuthorizeTrialSpending,
        createWallet
      });

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(findWalletByUserId).toHaveBeenCalledWith(userId);
      expect(createAndAuthorizeTrialSpending).not.toHaveBeenCalled();
      expect(createWallet).not.toHaveBeenCalled();
    });

    it("throws an error when cannot authorize trial spending and deletes user wallet", async () => {
      const userId = "test-user-id";
      const findWalletByUserId = jest.fn().mockImplementation(async () => null);
      const newWallet = UserWalletSeeder.create({ userId });
      const createWallet = jest.fn().mockImplementation(async () => newWallet);
      const deleteWalletById = jest.fn().mockImplementation(async () => null);
      const createAndAuthorizeTrialSpending = jest.fn().mockRejectedValue(new Error("Failed to authorize trial"));

      const di = setup({
        findWalletByUserId,
        createWallet,
        deleteWalletById,
        createAndAuthorizeTrialSpending
      });

      await expect(di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId)).rejects.toThrow("Failed to authorize trial");
      expect(createAndAuthorizeTrialSpending).toHaveBeenCalledWith({ addressIndex: newWallet.id });
      expect(deleteWalletById).toHaveBeenCalledWith(newWallet.id);
    });
  });

  function setup(input?: SetupInput) {
    const di = container.createChildContainer();
    di.registerInstance(
      ManagedUserWalletService,
      mock<ManagedUserWalletService>({
        createAndAuthorizeTrialSpending: input?.createAndAuthorizeTrialSpending
      })
    );
    di.registerInstance(
      UserWalletRepository,
      mock<UserWalletRepository>({
        findOneByUserId: input?.findWalletByUserId,
        updateById: input?.updateWalletById,
        deleteById: input?.deleteWalletById ?? jest.fn(),
        accessibleBy() {
          return this;
        },
        create: input?.createWallet,
        toPublic: value => value
      })
    );
    di.registerInstance(
      AuthService,
      mock<AuthService>({
        ability: {}
      })
    );

    container.clearInstances();

    return di;
  }

  interface SetupInput {
    findWalletByUserId?: UserWalletRepository["findOneByUserId"];
    updateWalletById?: UserWalletRepository["updateById"];
    createWallet?: UserWalletRepository["create"];
    deleteWalletById?: UserWalletRepository["deleteById"];
    createAndAuthorizeTrialSpending?: ManagedUserWalletService["createAndAuthorizeTrialSpending"];
  }
});
