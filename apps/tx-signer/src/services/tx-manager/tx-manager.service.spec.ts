import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createAkashAddress } from "../../../test/seeders";
import type { SignAndBroadcastOptions, SigningClientService } from "../../lib/signing-client/signing-client.service";
import type { Wallet } from "../../lib/wallet/wallet";
import type { LoggerService } from "../../providers";
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

      const { service, fundingSigningClient } = setup({
        fundingSignAndBroadcast: vi.fn().mockResolvedValue(txResult)
      });

      const result = await service.signAndBroadcastWithFundingWallet(messages);

      expect(fundingSigningClient.signAndBroadcast).toHaveBeenCalledWith(messages);
      expect(result).toEqual(txResult);
    });
  });

  describe("getFundingWalletAddress", () => {
    it("returns funding wallet address", async () => {
      const address = createAkashAddress();
      const { service, fundingWallet } = setup({
        fundingWalletAddress: address
      });

      const result = await service.getFundingWalletAddress();

      expect(fundingWallet.getFirstAddress).toHaveBeenCalled();
      expect(result).toBe(address);
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
      expect(logger.debug).toHaveBeenCalledWith({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex });
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

  describe("getDerivedWalletAddress", () => {
    it("returns derived wallet address for given index", async () => {
      const index = 5;
      const address = createAkashAddress();
      const { service, derivedWallet } = setup({
        derivedWalletAddress: address
      });

      const result = await service.getDerivedWalletAddress(index);

      expect(derivedWallet.getFirstAddress).toHaveBeenCalled();
      expect(result).toBe(address);
    });
  });

  describe("getDerivedWallet", () => {
    it("returns wallet from factory with correct index", () => {
      const index = 3;
      const { service, walletFactory, derivedWallet } = setup();

      const result = service.getDerivedWallet(index);

      expect(walletFactory).toHaveBeenCalledWith(index);
      expect(result).toBe(derivedWallet);
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

    const oldMasterWallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(createAkashAddress())
    });

    const derivedWallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(derivedWalletAddress)
    });

    const fundingSigningClient = mock<SigningClientService>({
      signAndBroadcast: input?.fundingSignAndBroadcast ?? vi.fn()
    });

    const oldMasterSigningClient = mock<SigningClientService>({
      signAndBroadcast: vi.fn()
    });

    const derivedSigningClient = mock<SigningClientService>({
      signAndBroadcast: input?.derivedSignAndBroadcast ?? vi.fn()
    });

    const walletFactory = vi.fn().mockImplementation((_index: number) => {
      return derivedWallet;
    });

    const oldWalletFactory = vi.fn().mockImplementation((_index: number) => {
      return derivedWallet;
    });

    const signingClientServiceFactory = vi.fn().mockImplementation((_wallet: Wallet) => {
      return derivedSigningClient;
    });

    const logger = mock<LoggerService>();

    const walletResources = {
      v1: {
        masterWallet: oldMasterWallet,
        masterSigningClient: oldMasterSigningClient,
        derivedWalletFactory: oldWalletFactory
      },
      v2: {
        masterWallet: fundingWallet,
        masterSigningClient: fundingSigningClient,
        derivedWalletFactory: walletFactory
      }
    };

    const service = new TxManagerService(walletResources, signingClientServiceFactory, logger);

    return {
      service,
      walletFactory,
      oldWalletFactory,
      fundingWallet,
      oldMasterWallet,
      derivedWallet,
      fundingSigningClient,
      oldMasterSigningClient,
      derivedSigningClient,
      signingClientServiceFactory,
      logger
    };
  }
});
