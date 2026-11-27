import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { TxService } from "@src/core/services";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { FundingWalletRegistryService, isFundingWalletDrainingError } from "./funding-wallet-registry.service";

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
      expect(fundingWalletRepository.findActiveOrAny).not.toHaveBeenCalled();
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
    it("returns the network\x27s active wallet", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup({ active });

      await expect(service.getActiveAddress()).resolves.toBe(active.address);

      expect(fundingWalletRepository.findActiveOrAny).toHaveBeenCalledWith(NETWORK);
    });

    it("returns the configured wallet and registers nothing when the network has no funding wallet yet", async () => {
      const { service, fundingWalletRepository, txService, configuredAddress } = setup();

      await expect(service.getActiveAddress()).resolves.toBe(configuredAddress);

      expect(fundingWalletRepository.findActiveOrAny).toHaveBeenCalledWith(NETWORK);
      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
      expect(fundingWalletRepository.lockNetwork).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("refuses with 503 when the network has wallets but none is active", async () => {
      const { service, txManagerService } = setup({ hasNoneActive: true });

      await expect(service.getActiveAddress()).rejects.toMatchObject({ status: 503, message: "No funding wallet is active", network: NETWORK });

      expect(txManagerService.getFundingWalletAddress).not.toHaveBeenCalled();
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

    it("returns the configured wallet and registers nothing when the network has no funding wallet yet", async () => {
      const { service, fundingWalletRepository, configuredAddress } = setup();

      await expect(service.getGranterAddressByWalletId(USER_WALLET_ID)).resolves.toBe(configuredAddress);

      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
    });

    it("refuses with 503 for an unassigned user wallet when the network has wallets but none is active", async () => {
      const { service } = setup({ hasNoneActive: true });

      await expect(service.getGranterAddressByWalletId(USER_WALLET_ID)).rejects.toMatchObject({ status: 503 });
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

    it("returns the configured wallet when the network has no funding wallet yet", async () => {
      const { service, configuredAddress } = setup();

      await expect(service.getGranterAddressByWalletAddress(USER_WALLET_ADDRESS)).resolves.toBe(configuredAddress);
    });
  });

  describe("assignGranterAddress", () => {
    it("assigns the active wallet to a user wallet that has no granter and returns its address", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup({ active, granterAfterAssigning: active });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(active.address);

      expect(fundingWalletRepository.assignUnlessAssigned).toHaveBeenCalledWith({ userWalletId: USER_WALLET_ID, network: NETWORK, fundingWalletId: active.id });
    });

    it("refuses a grant for a user wallet whose funding wallet is draining", async () => {
      const granter = fundingWallet({ status: "draining" });
      const { service, fundingWalletRepository } = setup({ active: fundingWallet({ status: "active" }), granter });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).rejects.toMatchObject({
        status: 503,
        message: "This balance is being moved to another funding wallet, try again shortly",
        network: NETWORK,
        errorCode: "funding_wallet_draining"
      });

      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
    });

    it("returns the wallet the user is already assigned to and writes nothing", async () => {
      const granter = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository, txService } = setup({ active: fundingWallet({ status: "active" }), granter });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(granter.address);

      expect(fundingWalletRepository.findGranterOf).toHaveBeenCalledWith(USER_WALLET_ID, NETWORK);
      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
      expect(fundingWalletRepository.findActive).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("assigns without leaving the caller\x27s transaction and reads the granter again afterwards", async () => {
      const active = fundingWallet({ status: "active" });
      const { service, txService, calls } = setup({ active, granterAfterAssigning: active });

      await service.assignGranterAddress(USER_WALLET_ID);

      expect(calls).toEqual(["findGranterOf", "assignUnlessAssigned", "findGranterOf"]);
      expect(txService.outsideTransaction).not.toHaveBeenCalled();
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

    it("registers the configured wallet as active when the network has none, and puts the existing user wallets and this one on it", async () => {
      const registered = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository, configuredAddress } = setup({ registered, granterAfterAssigning: registered });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(registered.address);

      expect(fundingWalletRepository.create).toHaveBeenCalledWith({ network: NETWORK, address: configuredAddress, status: "active" });
      expect(fundingWalletRepository.assignInitializedUserWallets).toHaveBeenCalledWith({ network: NETWORK, fundingWalletId: registered.id });
      expect(fundingWalletRepository.assignUnlessAssigned).toHaveBeenCalledWith({
        userWalletId: USER_WALLET_ID,
        network: NETWORK,
        fundingWalletId: registered.id
      });
    });

    it("registers inside the caller\x27s transaction, under the network\x27s lock", async () => {
      const { service, fundingWalletRepository, txService, calls } = setup();

      await service.assignGranterAddress(USER_WALLET_ID);

      expect(calls).toEqual(["findGranterOf", "transaction", "lockNetwork", "create", "assignUnlessAssigned", "findGranterOf"]);
      expect(fundingWalletRepository.lockNetwork).toHaveBeenCalledWith(NETWORK);
      expect(txService.outsideTransaction).not.toHaveBeenCalled();
    });

    it("assigns the wallet another process registered while this one waited for the lock", async () => {
      const registeredElsewhere = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository } = setup({ granterAfterAssigning: registeredElsewhere });
      fundingWalletRepository.findActive.mockResolvedValue(undefined);
      fundingWalletRepository.findActiveOrAny.mockResolvedValue(registeredElsewhere);

      await expect(service.assignGranterAddress(USER_WALLET_ID)).resolves.toBe(registeredElsewhere.address);

      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
      expect(fundingWalletRepository.assignInitializedUserWallets).not.toHaveBeenCalled();
      expect(fundingWalletRepository.assignUnlessAssigned).toHaveBeenCalledWith(expect.objectContaining({ fundingWalletId: registeredElsewhere.id }));
    });

    it("refuses with 503 rather than registering when the network has wallets but none is active", async () => {
      const { service, fundingWalletRepository } = setup({ hasNoneActive: true });

      await expect(service.assignGranterAddress(USER_WALLET_ID)).rejects.toMatchObject({ status: 503, network: NETWORK });

      expect(fundingWalletRepository.findActiveOrAny).toHaveBeenCalledWith(NETWORK);
      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
      expect(fundingWalletRepository.assignUnlessAssigned).not.toHaveBeenCalled();
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
      registered?: FundingWalletOutput;
      hasNoneActive?: boolean;
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
    fundingWalletRepository.findActiveOrAny.mockResolvedValue(input.active ?? (input.hasNoneActive ? fundingWallet({ status: "draining" }) : undefined));
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
      return input.registered ?? fundingWallet();
    });
    txService.transaction.mockImplementation(async cb => {
      calls.push("transaction");
      return await cb();
    });

    const service = new FundingWalletRegistryService(fundingWalletRepository, txManagerService, featureFlagsService, coreConfigService, txService);

    return { service, fundingWalletRepository, txManagerService, featureFlagsService, txService, configuredAddress, calls };
  }
});

describe(isFundingWalletDrainingError.name, () => {
  it("recognises the refusal of a grant from a draining funding wallet", async () => {
    const refusal = createError(503, "This balance is being moved to another funding wallet, try again shortly", { errorCode: "funding_wallet_draining" });

    expect(isFundingWalletDrainingError(refusal)).toBe(true);
  });

  it.each([
    ["another refusal", createError(503, "No funding wallet is active", { errorCode: "no_active_funding_wallet" })],
    ["a refusal without a code", createError(503, "The signer is unavailable")],
    ["an error that only carries the same code", Object.assign(new Error("not an http error"), { errorCode: "funding_wallet_draining" })],
    ["nothing", undefined]
  ])("does not take %s for it", (_case, error) => {
    expect(isFundingWalletDrainingError(error)).toBe(false);
  });
});
