import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { mock } from "jest-mock-extended";

import { createAkashAddress } from "../../../test/seeders";
import type { BatchSigningClientService, SignAndBroadcastOptions } from "../../lib/batch-signing-client/batch-signing-client.service";
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
        fundingSignAndBroadcast: jest.fn().mockResolvedValue(txResult)
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

      const { service, logger, derivedWallet, batchSigningClientServiceFactory } = setup({
        derivedWalletAddress: address,
        derivedSignAndBroadcast: jest.fn().mockResolvedValue(txResult),
        hasPendingTransactions: false
      });

      const result = await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);

      expect(derivedWallet.getFirstAddress).toHaveBeenCalled();
      expect(batchSigningClientServiceFactory).toHaveBeenCalledWith(derivedWallet);
      expect(logger.debug).toHaveBeenCalledWith({ event: "DERIVED_SIGNING_CLIENT_CREATE", address });
      expect(result).toEqual(txResult);
    });

    it("cleans up client when no pending transactions", async () => {
      const derivationIndex = 1;
      const address = createAkashAddress();
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

      const { service, logger } = setup({
        derivedWalletAddress: address,
        derivedSignAndBroadcast: jest.fn().mockResolvedValue(txResult),
        hasPendingTransactions: false
      });

      await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages);

      expect(logger.debug).toHaveBeenCalledWith({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", address });
    });

    it("keeps client when has pending transactions", async () => {
      const derivationIndex = 1;
      const address = createAkashAddress();
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

      const { service, logger } = setup({
        derivedWalletAddress: address,
        derivedSignAndBroadcast: jest.fn().mockResolvedValue(txResult),
        hasPendingTransactions: true
      });

      await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages);

      expect(logger.debug).not.toHaveBeenCalledWith({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", address });
    });

    it("cleans up client even when transaction fails", async () => {
      const derivationIndex = 1;
      const address = createAkashAddress();
      const messages: EncodeObject[] = [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ];
      const error = new Error("Transaction failed");

      const { service, logger } = setup({
        derivedWalletAddress: address,
        derivedSignAndBroadcast: jest.fn().mockRejectedValue(error),
        hasPendingTransactions: false
      });

      await expect(service.signAndBroadcastWithDerivedWallet(derivationIndex, messages)).rejects.toThrow("Transaction failed");

      expect(logger.debug).toHaveBeenCalledWith({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", address });
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
    fundingSignAndBroadcast?: BatchSigningClientService["signAndBroadcast"];
    derivedSignAndBroadcast?: BatchSigningClientService["signAndBroadcast"];
    hasPendingTransactions?: boolean;
  }) {
    const fundingWalletAddress = input?.fundingWalletAddress ?? createAkashAddress();
    const derivedWalletAddress = input?.derivedWalletAddress ?? createAkashAddress();

    const fundingWallet = mock<Wallet>({
      getFirstAddress: jest.fn().mockResolvedValue(fundingWalletAddress)
    });

    const oldMasterWallet = mock<Wallet>({
      getFirstAddress: jest.fn().mockResolvedValue(createAkashAddress())
    });

    const derivedWallet = mock<Wallet>({
      getFirstAddress: jest.fn().mockResolvedValue(derivedWalletAddress)
    });

    const fundingSigningClient = mock<BatchSigningClientService>({
      signAndBroadcast: input?.fundingSignAndBroadcast ?? jest.fn()
    });

    const oldMasterSigningClient = mock<BatchSigningClientService>({
      signAndBroadcast: jest.fn()
    });

    const derivedSigningClient = mock<BatchSigningClientService>({
      signAndBroadcast: input?.derivedSignAndBroadcast ?? jest.fn(),
      hasPendingTransactions: input?.hasPendingTransactions ?? false
    });

    const walletFactory = jest.fn().mockImplementation((_index: number) => {
      return derivedWallet;
    });

    const oldWalletFactory = jest.fn().mockImplementation((_index: number) => {
      return derivedWallet;
    });

    const batchSigningClientServiceFactory = jest.fn().mockImplementation((_wallet: Wallet) => {
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

    const service = new TxManagerService(walletResources, batchSigningClientServiceFactory, logger);

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
      batchSigningClientServiceFactory,
      logger
    };
  }
});
