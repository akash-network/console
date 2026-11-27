import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import type { CreateLogger } from "@src/core";
import type { TxService } from "@src/core/services";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FundingWalletRotationService } from "./funding-wallet-rotation.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";

describe(FundingWalletRotationService.name, () => {
  describe("addStandby", () => {
    it("records the wallet as standby, after making sure the network's current wallet is registered", async () => {
      const address = createAkashAddress();
      const { service, fundingWalletRepository, calls } = setup();

      await expect(service.addStandby(address)).resolves.toMatchObject({ address, status: "standby" });

      expect(calls).toEqual(["transaction", "lockNetwork", "findOrRegisterActive", "create"]);
      expect(fundingWalletRepository.lockNetwork).toHaveBeenCalledWith(NETWORK);
      expect(fundingWalletRepository.findByAddress).toHaveBeenCalledWith(NETWORK, address);
      expect(fundingWalletRepository.create).toHaveBeenCalledWith({ network: NETWORK, address, status: "standby" });
    });

    it("returns a wallet that is already standby without recording it again", async () => {
      const standby = fundingWallet({ status: "standby" });
      const { service, fundingWalletRepository } = setup({ known: standby });

      await expect(service.addStandby(standby.address)).resolves.toBe(standby);

      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
    });

    it.each(["active", "draining", "retired"] as const)("refuses a wallet that is already %s", async status => {
      const known = fundingWallet({ status });
      const { service, fundingWalletRepository } = setup({ known });

      await expect(service.addStandby(known.address)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${known.address} is already ${status}`,
        network: NETWORK
      });

      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
    });

    it("refuses while the registry is switched off, before touching it", async () => {
      const { service, fundingWalletRepository, txService } = setup({ isEnabled: false });

      await expect(service.addStandby(createAkashAddress())).rejects.toMatchObject({
        status: 409,
        message: "The funding wallet registry is switched off on this network",
        network: NETWORK
      });

      expect(txService.transaction).not.toHaveBeenCalled();
      expect(fundingWalletRepository.create).not.toHaveBeenCalled();
    });

    it("logs the standby it added", async () => {
      const address = createAkashAddress();
      const { service, logger } = setup();

      await service.addStandby(address);

      expect(logger.info).toHaveBeenCalledWith({ event: "FUNDING_WALLET_STANDBY_ADDED", network: NETWORK, address });
    });
  });

  describe("promote", () => {
    it("makes the standby wallet active and the wallet it replaces draining, in that order inside one locked transaction", async () => {
      const standby = fundingWallet({ status: "standby" });
      const replaced = fundingWallet({ status: "active" });
      const { service, fundingWalletRepository, calls } = setup({ known: standby, active: replaced });

      const promotion = await service.promote(standby.address);

      expect(promotion).toEqual({ active: { ...standby, status: "active" }, draining: { ...replaced, status: "draining" } });
      expect(calls).toEqual([
        "transaction",
        "lockNetwork",
        "findOrRegisterActive",
        `updateStatus:${replaced.id}:draining`,
        `updateStatus:${standby.id}:active`
      ]);
      expect(fundingWalletRepository.findByStatus).toHaveBeenCalledWith(NETWORK, "draining");
    });

    it.each(["active", "draining", "retired"] as const)("refuses to promote a wallet that is %s", async status => {
      const known = fundingWallet({ status });
      const { service, fundingWalletRepository } = setup({ known });

      await expect(service.promote(known.address)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${known.address} is ${status}, and only a standby wallet can be promoted`,
        network: NETWORK
      });

      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("refuses to promote an address that was never added", async () => {
      const address = createAkashAddress();
      const { service, fundingWalletRepository } = setup();

      await expect(service.promote(address)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${address} is not registered, and only a standby wallet can be promoted`
      });

      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("refuses while another wallet is still draining", async () => {
      const standby = fundingWallet({ status: "standby" });
      const draining = fundingWallet({ status: "draining" });
      const { service, fundingWalletRepository } = setup({ known: standby, draining });

      await expect(service.promote(standby.address)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${draining.address} is still draining`,
        network: NETWORK
      });

      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("refuses while the registry is switched off, before touching it", async () => {
      const { service, txService } = setup({ isEnabled: false });

      await expect(service.promote(createAkashAddress())).rejects.toMatchObject({ status: 409, network: NETWORK });

      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("logs which wallet became active and which one drains", async () => {
      const standby = fundingWallet({ status: "standby" });
      const replaced = fundingWallet({ status: "active" });
      const { service, logger } = setup({ known: standby, active: replaced });

      await service.promote(standby.address);

      expect(logger.info).toHaveBeenCalledWith({ event: "FUNDING_WALLET_PROMOTED", network: NETWORK, active: standby.address, draining: replaced.address });
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FundingWalletRotationService.name });
  });

  function fundingWallet(overrides: Partial<FundingWalletOutput> = {}): FundingWalletOutput {
    return { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "active", ...overrides };
  }

  function setup(input: { isEnabled?: boolean; known?: FundingWalletOutput; active?: FundingWalletOutput; draining?: FundingWalletOutput } = {}) {
    const calls: string[] = [];
    const fundingWalletRepository = mock<FundingWalletRepository>();
    const fundingWalletRegistry = mock<FundingWalletRegistryService>({ isEnabled: input.isEnabled ?? true });
    const txService = mock<TxService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const wallets = [input.known, input.active, input.draining].filter(wallet => !!wallet);

    txService.transaction.mockImplementation(async cb => {
      calls.push("transaction");
      return await cb();
    });
    fundingWalletRepository.lockNetwork.mockImplementation(async () => {
      calls.push("lockNetwork");
    });
    fundingWalletRepository.findByAddress.mockResolvedValue(input.known);
    fundingWalletRepository.findByStatus.mockResolvedValue(input.draining ? [input.draining] : []);
    fundingWalletRepository.create.mockImplementation(async wallet => {
      calls.push("create");
      return { id: crypto.randomUUID(), ...wallet };
    });
    fundingWalletRepository.updateStatus.mockImplementation(async (id, status) => {
      calls.push(`updateStatus:${id}:${status}`);
      return { ...wallets.find(wallet => wallet.id === id)!, status };
    });
    fundingWalletRegistry.findOrRegisterActive.mockImplementation(async () => {
      calls.push("findOrRegisterActive");
      return input.active ?? fundingWallet({ status: "active" });
    });

    const service = new FundingWalletRotationService(
      fundingWalletRepository,
      fundingWalletRegistry,
      mockConfigService<CoreConfigService>({ NETWORK }),
      txService,
      createLogger
    );

    return { service, fundingWalletRepository, fundingWalletRegistry, txService, logger, createLogger, calls };
  }
});
