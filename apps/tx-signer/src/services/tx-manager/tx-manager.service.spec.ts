import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createAkashAddress } from "../../../test/seeders";
import type { SignAndBroadcastOptions, SigningClientService } from "../../lib/signing-client/signing-client.service";
import type { Wallet } from "../../lib/wallet/wallet";
import type { LoggerService } from "../../providers";
import type { DerivationSeedService } from "../derivation-seed/derivation-seed.service";
import { TxManagerService } from "./tx-manager.service";

describe(TxManagerService.name, () => {
  describe("signAndBroadcastWithFundingWallet", () => {
    it("signs and broadcasts messages using funding wallet", async () => {
      const messages: EncodeObject[] = [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ];
      const txResult = mock<IndexedTx>({
        code: 0,
        hash: "tx-hash",
        rawLog: "success"
      });

      const { service, fundingSigningClient, secondFundingSigningClient, fundingWalletAddress } = setup({
        fundingSignAndBroadcast: vi.fn().mockResolvedValue(txResult)
      });

      const result = await service.signAndBroadcastWithFundingWallet(fundingWalletAddress, messages);

      expect(fundingSigningClient.signAndBroadcast).toHaveBeenCalledWith(messages);
      expect(secondFundingSigningClient.signAndBroadcast).not.toHaveBeenCalled();
      expect(result).toEqual(txResult);
    });

    it("signs with the second funding wallet when its address is named", async () => {
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const { service, fundingSigningClient, secondFundingSigningClient, secondFundingWalletAddress } = setup();

      await service.signAndBroadcastWithFundingWallet(secondFundingWalletAddress, messages);

      expect(secondFundingSigningClient.signAndBroadcast).toHaveBeenCalledWith(messages);
      expect(fundingSigningClient.signAndBroadcast).not.toHaveBeenCalled();
    });

    it("refuses an address no funding wallet has", async () => {
      const { service, fundingSigningClient, secondFundingSigningClient } = setup();
      const unknownAddress = createAkashAddress();

      await expect(service.signAndBroadcastWithFundingWallet(unknownAddress, [])).rejects.toThrow(`No funding wallet is configured for ${unknownAddress}`);

      expect(fundingSigningClient.signAndBroadcast).not.toHaveBeenCalled();
      expect(secondFundingSigningClient.signAndBroadcast).not.toHaveBeenCalled();
    });
  });

  describe("getFundingWalletAddresses", () => {
    it("returns the address of every funding wallet, in the order they are configured", async () => {
      const { service, fundingWalletAddress, secondFundingWalletAddress } = setup();

      await expect(service.getFundingWalletAddresses()).resolves.toEqual([fundingWalletAddress, secondFundingWalletAddress]);
    });
  });

  describe("signAndBroadcastWithDerivedWallet", () => {
    it("creates new client when not cached and signs transaction", async () => {
      const derivationIndex = 1;
      const address = createAkashAddress();
      const messages: EncodeObject[] = [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ];
      const options: SignAndBroadcastOptions = {
        fee: { granter: createAkashAddress() }
      };
      const txResult = mock<IndexedTx>({
        code: 0,
        hash: "tx-hash",
        rawLog: "success"
      });

      const { service, logger, derivedWallet, signingClientServiceFactory } = setup({
        derivedWalletAddress: address,
        derivedSignAndBroadcast: vi.fn().mockResolvedValue(txResult)
      });

      const result = await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);

      expect(signingClientServiceFactory).toHaveBeenCalledWith(derivedWallet);
      expect(logger.debug).toHaveBeenCalledWith({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex, seedVersion: "v2" });
      expect(result).toEqual(txResult);
    });

    it("reuses the cached client across calls for the same derivation index", async () => {
      const derivationIndex = 1;
      const messages: EncodeObject[] = [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ];
      const txResult = mock<IndexedTx>({
        code: 0,
        hash: "tx-hash",
        rawLog: "success"
      });

      const { service, signingClientServiceFactory } = setup({
        derivedWalletAddress: createAkashAddress(),
        derivedSignAndBroadcast: vi.fn().mockResolvedValue(txResult)
      });

      await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages);
      await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages);

      expect(signingClientServiceFactory).toHaveBeenCalledTimes(1);
    });

    it("propagates the error when the transaction fails", async () => {
      const derivationIndex = 1;
      const messages: EncodeObject[] = [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ];
      const error = new Error("Transaction failed");

      const { service } = setup({
        derivedWalletAddress: createAkashAddress(),
        derivedSignAndBroadcast: vi.fn().mockRejectedValue(error)
      });

      await expect(service.signAndBroadcastWithDerivedWallet(derivationIndex, messages)).rejects.toThrow("Transaction failed");
    });
  });

  describe("signAndBroadcastWithDerivedWallet with a seed version", () => {
    it("signs with the wallet of the seed version the request names", async () => {
      const { service, derivationSeedService, signingClientServiceFactory, derivedWallet } = setup();

      await service.signAndBroadcastWithDerivedWallet(4, [], undefined, "v3");

      expect(derivationSeedService.deriveWallet).toHaveBeenCalledWith(4, "v3");
      expect(signingClientServiceFactory).toHaveBeenCalledWith(derivedWallet);
    });

    it("signs with the wallet of the current seed when the request names no version", async () => {
      const { service, derivationSeedService } = setup();

      await service.signAndBroadcastWithDerivedWallet(4, []);

      expect(derivationSeedService.deriveWallet).toHaveBeenCalledWith(4, "v2");
    });

    it("keeps one signing client per seed version of an index", async () => {
      const { service, signingClientServiceFactory, logger } = setup();

      await service.signAndBroadcastWithDerivedWallet(4, [], undefined, "v2");
      await service.signAndBroadcastWithDerivedWallet(4, [], undefined, "v3");
      await service.signAndBroadcastWithDerivedWallet(4, [], undefined, "v3");

      expect(signingClientServiceFactory).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex: 4, seedVersion: "v3" });
    });

    it("signs nothing with a seed version kept for addresses only", async () => {
      const { service, derivationSeedService, derivedSigningClient } = setup();

      await expect(service.signAndBroadcastWithDerivedWallet(4, [], undefined, "v1")).rejects.toMatchObject({ status: 403 });

      expect(derivationSeedService.deriveWallet).not.toHaveBeenCalled();
      expect(derivedSigningClient.signAndBroadcast).not.toHaveBeenCalled();
    });
  });

  describe("getDerivedWalletAddress", () => {
    it("returns the address at an index of the current seed when no version is named", async () => {
      const address = createAkashAddress();
      const { service, derivationSeedService } = setup({ derivedWalletAddress: address });

      await expect(service.getDerivedWalletAddress(5)).resolves.toBe(address);

      expect(derivationSeedService.deriveWallet).toHaveBeenCalledWith(5, "v2");
    });

    it.each(["v1", "v3"])("returns the address at an index of seed version %s, which signing is not needed for", async seedVersion => {
      const address = createAkashAddress();
      const { service, derivationSeedService } = setup({ derivedWalletAddress: address });

      await expect(service.getDerivedWalletAddress(5, seedVersion)).resolves.toBe(address);

      expect(derivationSeedService.deriveWallet).toHaveBeenCalledWith(5, seedVersion);
    });

    it("passes on why a seed version cannot be served", async () => {
      const { service, derivationSeedService } = setup();
      derivationSeedService.deriveWallet.mockImplementation(() => {
        throw new Error("This signer holds no derivation seed v9");
      });

      await expect(service.getDerivedWalletAddress(5, "v9")).rejects.toThrow("This signer holds no derivation seed v9");
    });
  });

  describe("getDerivedWallet", () => {
    it("returns the wallet at an index of the current seed when no version is named", () => {
      const { service, derivationSeedService, derivedWallet } = setup();

      expect(service.getDerivedWallet(3)).toBe(derivedWallet);
      expect(derivationSeedService.deriveWallet).toHaveBeenCalledWith(3, "v2");
    });

    it("returns the wallet at an index of the seed version named", () => {
      const { service, derivationSeedService, derivedWallet } = setup();

      expect(service.getDerivedWallet(3, "v3")).toBe(derivedWallet);
      expect(derivationSeedService.deriveWallet).toHaveBeenCalledWith(3, "v3");
    });

    it("hands out no wallet of a seed version kept for addresses only", () => {
      const { service, derivationSeedService } = setup();

      expect(() => service.getDerivedWallet(3, "v1")).toThrow("Derivation seed v1 only answers addresses, so nothing is signed with it");
      expect(derivationSeedService.deriveWallet).not.toHaveBeenCalled();
    });
  });

  function setup(input?: {
    fundingWalletAddress?: string;
    derivedWalletAddress?: string;
    fundingSignAndBroadcast?: SigningClientService["signAndBroadcast"];
    derivedSignAndBroadcast?: SigningClientService["signAndBroadcast"];
  }) {
    const fundingWalletAddress = input?.fundingWalletAddress ?? createAkashAddress();
    const derivedWalletAddress = input?.derivedWalletAddress ?? createAkashAddress();

    const fundingWallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(fundingWalletAddress)
    });

    const secondFundingWalletAddress = createAkashAddress();
    const secondFundingWallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(secondFundingWalletAddress)
    });
    const secondFundingSigningClient = mock<SigningClientService>({
      signAndBroadcast: vi.fn()
    });

    const derivedWallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(derivedWalletAddress)
    });

    const fundingSigningClient = mock<SigningClientService>({
      signAndBroadcast: input?.fundingSignAndBroadcast ?? vi.fn()
    });

    const derivedSigningClient = mock<SigningClientService>({
      signAndBroadcast: input?.derivedSignAndBroadcast ?? vi.fn()
    });

    const derivationSeedService = mock<DerivationSeedService>();
    derivationSeedService.deriveWallet.mockReturnValue(derivedWallet);

    const signingClientServiceFactory = vi.fn().mockImplementation((_wallet: Wallet) => {
      return derivedSigningClient;
    });

    const logger = mock<LoggerService>();

    const walletResources = {
      fundingWallets: [
        { wallet: fundingWallet, signingClient: fundingSigningClient },
        { wallet: secondFundingWallet, signingClient: secondFundingSigningClient }
      ]
    };

    const service = new TxManagerService(walletResources, signingClientServiceFactory, derivationSeedService, logger);

    return {
      service,
      derivationSeedService,
      fundingWallet,
      derivedWallet,
      fundingSigningClient,
      secondFundingSigningClient,
      fundingWalletAddress,
      secondFundingWalletAddress,
      derivedSigningClient,
      signingClientServiceFactory,
      logger
    };
  }
});
