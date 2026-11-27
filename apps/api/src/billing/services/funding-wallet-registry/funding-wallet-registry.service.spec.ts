import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { TxService } from "@src/core/services";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { FundingWalletRegistryService } from "./funding-wallet-registry.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";
const USER_WALLET_ID = 42;
const USER_WALLET_ADDRESS = createAkashAddress();

describe(FundingWalletRegistryService.name, () => {
  describe("when the registry flag is off", () => {
    it("answers every question with the configured wallet and reads no registry", async () => {
      const { service, fundingWalletRepository, configuredAddress } = setup({ isEnabled: false });

      await expect(service.getActiveAddress()).resolves.toBe(configuredAddress);
      await expect(service.getGranterAddressByWalletId(USER_WALLET_ID)).resolves.toBe(configuredAddress);
      await expect(service.getGranterAddressByWalletAddress(USER_WALLET_ADDRESS)).resolves.toBe(configuredAddress);
      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(configuredAddress);

      expect(fundingWalletRepository.findActive).not.toHaveBeenCalled();
      expect(fundingWalletRepository.findGranterOf).not.toHaveBeenCalled();
      expect(fundingWalletRepository.findGranterOfAddress).not.toHaveBeenCalled();
      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
    });

    it("reads the flag for the network, not for the caller", async () => {
      const { service, featureFlagsService } = setup({ isEnabled: false });

      await service.getActiveAddress();

      expect(featureFlagsService.isEnabledForSubject).toHaveBeenCalledWith(FeatureFlags.FUNDING_WALLET_REGISTRY, NETWORK);
    });
  });

  describe("getActiveAddress", () => {
    it("returns the network's active wallet without registering anything", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup({ active });

      await expect(service.getActiveAddress()).resolves.toBe(active.address);

      expect(fundingWalletRepository.findActive).toHaveBeenCalledWith(NETWORK);
      expect(fundingWalletRepository.lockNetwork).not.toHaveBeenCalled();
      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
    });

    it("registers the configured wallet as active and assigns the existing user wallets to it when the network has none", async () => {
      const { service, fundingWalletRepository, configuredAddress } = setup();
      const registered = fundingWallet({ address: configuredAddress, status: "active" });
      fundingWalletRepository.create.mockResolvedValue(registered);

      await expect(service.getActiveAddress()).resolves.toBe(configuredAddress);

      expect(fundingWalletRepository.create).toHaveBeenCalledWith({ network: NETWORK, address: configuredAddress, status: "active" });
      expect(fundingWalletRepository.assignInitializedUserWallets).toHaveBeenCalledWith({ network: NETWORK, fundingWalletId: registered.id });
    });

    it("registers in a transaction of its own, under the network's lock", async () => {
      const { service, fundingWalletRepository, txService, calls } = setup();

      await service.getActiveAddress();

      expect(calls).toEqual(["outsideTransaction", "transaction", "lockNetwork", "create"]);
      expect(fundingWalletRepository.lockNetwork).toHaveBeenCalledWith(NETWORK);
      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
    });

    it("returns the wallet another process registered while this one waited for the lock", async () => {
      const registeredElsewhere = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup();
      fundingWalletRepository.findActive.mockResolvedValueOnce(undefined).mockResolvedValueOnce(registeredElsewhere);

      await expect(service.getActiveAddress()).resolves.toBe(registeredElsewhere.address);

      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
      expect(fundingWalletRepository.assignInitializedUserWallets).not.toHaveBeenCalled();
    });

    it("refuses with 503 rather than registering when the network has wallets but none is active", async () => {
      const { service, fundingWalletRepository } = setup({ hasAny: true });

      await expect(service.getActiveAddress()).rejects.toMatchObject({ status: 503, network: NETWORK });

      expect(fundingWalletRepository.hasAny).toHaveBeenCalledWith(NETWORK);
      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getGranterAddressByWalletId", () => {
    it("returns the funding wallet the user wallet is assigned to, even when another one is active", async () => {
      const granter = fundingWallet({ status: "draining" });
      const { service, fundingWalletRepository } = setup({ active: fundingWallet({ status: "active" }), granter });

      await expect(service.getGranterAddressByWalletId(USER_WALLET_ID)).resolves.toBe(granter.address);

      expect(fundingWalletRepository.findGranterOf).toHaveBeenCalledWith(USER_WALLET_ID, NETWORK);
      expect(fundingWalletRepository.findActive).not.toHaveBeenCalled();
    });

    it("returns the active wallet for a user wallet that was never assigned, and assigns nothing", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup({ active });

      await expect(service.getGranterAddressByWalletId(USER_WALLET_ID)).resolves.toBe(active.address);

      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
    });
  });

  describe("getGranterAddressByWalletAddress", () => {
    it("returns the funding wallet the user wallet at that address is assigned to, even when another one is active", async () => {
      const granterOfAddress = fundingWallet({ status: "draining" });
      const { service, fundingWalletRepository } = setup({ active: fundingWallet({ status: "active" }), granterOfAddress });

      await expect(service.getGranterAddressByWalletAddress(USER_WALLET_ADDRESS)).resolves.toBe(granterOfAddress.address);

      expect(fundingWalletRepository.findGranterOfAddress).toHaveBeenCalledWith(USER_WALLET_ADDRESS, NETWORK);
      expect(fundingWalletRepository.findActive).not.toHaveBeenCalled();
    });

    it("returns the active wallet for an address no user wallet is assigned under", async () => {
      const active = fundingWallet({ status: "active" });
      const { service } = setup({ active });

      await expect(service.getGranterAddressByWalletAddress(USER_WALLET_ADDRESS)).resolves.toBe(active.address);
    });
  });

  describe("assignGranterAddress", () => {
    it("assigns the active wallet to a user wallet that has no granter and returns its address", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup({ active, granterAfterAssigning: active });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(active.address);

      expect(fundingWalletRepository.assignUnlessAssigned).toHaveBeenCalledWith({ userWalletId: USER_WALLET_ID, network: NETWORK, fundingWalletId: active.id });
    });

    it("returns the wallet the user is already assigned to and writes nothing", async () => {
      const granter = fundingWallet({ status: "draining" });
      const { service, fundingWalletRepository, txService } = setup({ active: fundingWallet({ status: "active" }), granter });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(granter.address);

      expect(fundingWalletRepository.findGranterOf).toHaveBeenCalledWith(USER_WALLET_ID, NETWORK);
      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
      expect(fundingWalletRepository.findActive).not.toHaveBeenCalled();
      expect(txService.outsideTransaction).not.toHaveBeenCalled();
    });

    it("assigns outside the caller's transaction and reads the granter again afterwards", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, calls } = setup({ active, granterAfterAssigning: active });

      await service.assignGranterAddress(USER_WALLET_ID);

      expect(calls).toEqual(["findGranterOf", "outsideTransaction", "assignUnlessAssigned", "findGranterOf"]);
    });

    it("returns the wallet another request assigned first, not the active one it tried to assign", async () => {
      const assignedElsewhere = fundingWallet({ status: "draining" });
      const { service } = setup({ active: fundingWallet({ status: "active" }), granterAfterAssigning: assignedElsewhere });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(assignedElsewhere.address);
    });

    it("falls back to the active wallet when the assignment cannot be read back", async () => {
      const active = fundingWallet({ status: "active" });
      const { service } = setup({ active });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(active.address);
    });
  });

  function fundingWallet(overrides: Partial<FundingWalletOutput> = {}): FundingWalletOutput {
    return { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "active", ...overrides };
  }

  function setup(
    input: {
      isEnabled?: boolean;
      active?: FundingWalletOutput;
      granter?: FundingWalletOutput;
      granterAfterAssigning?: FundingWalletOutput;
      granterOfAddress?: FundingWalletOutput;
      hasAny?: boolean;
    } = {}
  ) {
    const calls: string[] = [];
    const configuredAddress = createAkashAddress();
    const fundingWalletRepository = mock<FundingWalletRepository>();
    const txManagerService = mock<TxManagerService>();
    const featureFlagsService = mock<FeatureFlagsService>();
    const coreConfigService = mockConfigService<CoreConfigService>({ NETWORK });
    const txService = mock<TxService>();

    txManagerService.getFundingWalletAddress.mockResolvedValue(configuredAddress);
    featureFlagsService.isEnabledForSubject.mockReturnValue(input.isEnabled ?? true);
    fundingWalletRepository.findActive.mockResolvedValue(input.active);
    fundingWalletRepository.hasAny.mockResolvedValue(input.hasAny ?? false);
    fundingWalletRepository.findGranterOf.mockImplementation(async () => {
      const isAfterAssigning = calls.includes("assignUnlessAssigned");
      calls.push("findGranterOf");
      return isAfterAssigning ? input.granterAfterAssigning : input.granter;
    });
    fundingWalletRepository.findGranterOfAddress.mockResolvedValue(input.granterOfAddress);
    fundingWalletRepository.assignUnlessAssigned.mockImplementation(async () => {
      calls.push("assignUnlessAssigned");
    });
    fundingWalletRepository.lockNetwork.mockImplementation(async () => {
      calls.push("lockNetwork");
    });
    fundingWalletRepository.create.mockImplementation(async () => {
      calls.push("create");
      return fundingWallet();
    });
    txService.outsideTransaction.mockImplementation(async cb => {
      calls.push("outsideTransaction");
      return await cb();
    });
    txService.transaction.mockImplementation(async cb => {
      calls.push("transaction");
      return await cb();
    });

    const service = new FundingWalletRegistryService(fundingWalletRepository, txManagerService, featureFlagsService, coreConfigService, txService);

    return { service, fundingWalletRepository, txManagerService, featureFlagsService, txService, configuredAddress, calls };
  }
});
