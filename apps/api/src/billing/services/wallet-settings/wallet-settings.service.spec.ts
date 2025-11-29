import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";
import { PostgresError } from "postgres";
import { v4 as uuidv4 } from "uuid";

import type { AuthService } from "@src/auth/services/auth.service";
import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { PaymentMethod, StripeService } from "@src/billing/services/stripe/stripe.service";
import type { JobQueueService, TxService } from "@src/core";
import type { UserRepository } from "@src/user/repositories";
import { WalletSettingService } from "./wallet-settings.service";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

jest.mock("uuid");
const uuidMock = uuidv4 as jest.MockedFn<typeof uuidv4>;

describe(WalletSettingService.name, () => {
  describe("getWalletSetting", () => {
    it("returns wallet setting when found", async () => {
      const { user, publicSetting, walletSettingRepository, service } = setup();

      const result = await service.getWalletSetting(user.id);

      expect(result).toEqual(publicSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
    });

    it("returns undefined when wallet setting not found", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      const result = await service.getWalletSetting(user.id);

      expect(result).toBeUndefined();
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
    });
  });

  describe("upsertWalletSetting", () => {
    it("updates existing wallet setting", async () => {
      const { user, publicSetting, walletSetting, walletSettingRepository, service } = setup();
      const updatedSetting = generateWalletSetting({
        ...walletSetting,
        autoReloadEnabled: false,
        autoReloadThreshold: 20.75
      });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: false,
        autoReloadThreshold: 20.75
      });

      const { autoReloadJobId, ...publicUpdatedSetting } = updatedSetting;

      expect(result).toEqual(publicUpdatedSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        publicSetting.id,
        { autoReloadEnabled: false, autoReloadThreshold: 20.75 },
        { returning: true }
      );
    });

    it("creates new wallet setting when not exists", async () => {
      const { user, userWalletRepository, userWallet, walletSettingRepository, jobQueueService, jobId, service } = setup();
      const newSetting = generateWalletSetting({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      walletSettingRepository.create.mockResolvedValue(newSetting);
      jobQueueService.enqueue.mockResolvedValue(jobId);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });

      const { autoReloadJobId, ...publicSetting } = newSetting;

      expect(result).toEqual(publicSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(WalletBalanceReloadCheck), {
        singletonKey: `WalletBalanceReloadCheck.${user.id}`,
        id: jobId
      });
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(newSetting.id, { autoReloadJobId: jobId });
    });

    it("retries the update in case of a race condition", async () => {
      const { user, userWalletRepository, userWallet, walletSettingRepository, service } = setup();
      const newSetting = generateWalletSetting({ userId: user.id, walletId: userWallet.id });
      walletSettingRepository.findByUserId.mockResolvedValueOnce(undefined).mockResolvedValueOnce(newSetting);
      walletSettingRepository.updateById.mockResolvedValue(newSetting as any);
      walletSettingRepository.create.mockRejectedValue(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        new PostgresError({ message: 'duplicate key value violates unique constraint "wallet_settings_wallet_id_unique"', code: "23505" })
      );

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
      const { autoReloadJobId, ...newPublicSetting } = newSetting;

      expect(result).toEqual(newPublicSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
    });

    it("throws 400 when enabled is true and threshold and amount are not provided during create", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("throws 400 when enabled is true and only threshold is provided during create", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true,
          autoReloadThreshold: 15.5
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("throws 400 when enabled is true and only amount is provided during create", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true,
          autoReloadAmount: 25.0
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("updates existing setting using existing values when enabled is true and threshold and amount are not provided", async () => {
      const { user, walletSetting, walletSettingRepository, jobQueueService, jobId, service } = setup();
      const existingSetting = { ...walletSetting, autoReloadEnabled: false, autoReloadThreshold: 15.5, autoReloadAmount: 25.0 };
      const updatedSetting = generateWalletSetting({
        userId: user.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 15.5,
        autoReloadAmount: 25.0
      });
      walletSettingRepository.findByUserId.mockResolvedValue(existingSetting);
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);
      jobQueueService.enqueue.mockResolvedValue(jobId);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true
      });
      const { autoReloadJobId, ...publicUpdatedSetting } = updatedSetting;

      expect(result).toEqual(publicUpdatedSetting);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        existingSetting.id,
        {
          autoReloadEnabled: true
        },
        { returning: true }
      );
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(WalletBalanceReloadCheck), {
        singletonKey: `WalletBalanceReloadCheck.${user.id}`,
        id: jobId
      });
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(updatedSetting.id, { autoReloadJobId: jobId });
    });

    it("cancels job when auto-reload is disabled", async () => {
      const { user, walletSetting, walletSettingRepository, jobQueueService, service } = setup();
      const existingJobId = faker.string.uuid();
      const existingSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadJobId: existingJobId };
      const updatedSetting = {
        ...walletSetting,
        id: walletSetting.id,
        autoReloadEnabled: false,
        autoReloadJobId: existingJobId
      };
      walletSettingRepository.findByUserId.mockResolvedValue(existingSetting);
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: false
      });
      const { autoReloadJobId, ...publicUpdatedSetting } = updatedSetting;

      expect(result).toEqual(publicUpdatedSetting);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        walletSetting.id,
        {
          autoReloadEnabled: false
        },
        { returning: true }
      );
      expect(jobQueueService.cancel).toHaveBeenCalledWith(WalletBalanceReloadCheck.name, existingJobId);
    });

    it("throws 400 when enabled is true and existing setting does not have threshold and amount", async () => {
      const {
        user,
        walletSetting: { autoReloadThreshold, autoReloadAmount, ...walletSetting },
        walletSettingRepository,
        service
      } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("throws 404 when user wallet not found during create", async () => {
      const { user, userWalletRepository, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true,
          autoReloadThreshold: 20,
          autoReloadAmount: 20
        })
      ).rejects.toThrow("UserWallet Not Found");
    });
  });

  describe("deleteWalletSetting", () => {
    it("deletes wallet setting", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.deleteBy.mockResolvedValue(undefined);

      await service.deleteWalletSetting(user.id);

      expect(walletSettingRepository.deleteBy).toHaveBeenCalledWith({ userId: user.id });
    });
  });

  function setup() {
    const user = UserSeeder.create();
    const userWithStripe = { ...user, stripeCustomerId: faker.string.uuid() };
    const userWallet = UserWalletSeeder.create({ userId: user.id });
    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.accessibleBy.mockReturnValue(walletSettingRepository);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(userWithStripe);
    const paymentMethod = { ...generatePaymentMethod(), validated: true };
    const stripeService = mock<StripeService>({
      getDefaultPaymentMethod: jest.fn().mockResolvedValue(paymentMethod as PaymentMethod)
    });
    const walletSetting = generateWalletSetting({ userId: user.id });
    walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
    const ability = createMongoAbility();
    const authService = mock<AuthService>({
      currentUser: user,
      ability
    });
    const jobId = faker.string.uuid();
    uuidMock.mockReturnValue(jobId);
    const jobQueueService = mock<JobQueueService>({
      cancel: jest.fn().mockResolvedValue(undefined)
    });
    const txService = mock<TxService>({
      transaction: jest.fn(async <T>(cb: () => Promise<T>) => await cb()) as TxService["transaction"]
    });
    const service = new WalletSettingService(
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      stripeService,
      authService,
      jobQueueService,
      txService
    );
    const { autoReloadJobId, ...publicSetting } = walletSetting;

    return {
      user: userWithStripe,
      userWallet,
      walletSetting,
      publicSetting,
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      stripeService,
      authService,
      jobQueueService,
      jobId,
      service
    };
  }
});
