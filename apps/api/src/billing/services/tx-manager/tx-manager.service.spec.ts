import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { mock } from "jest-mock-extended";

import type { BatchSigningClientService, SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { ExternalSignerHttpSdkService } from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import type { LoggerService } from "@src/core";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxManagerService } from "./tx-manager.service";

import { createAkashAddress } from "@test/seeders";

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

    it("delegates to external signer when feature flag is enabled", async () => {
      const messages: EncodeObject[] = [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ];
      const txResult = mock<IndexedTx>({
        code: 0,
        hash: "external-tx-hash",
        rawLog: "success"
      });

      const { service, fundingSigningClient, externalSignerHttpSdkService } = setup({
        featureFlagsEnabled: true,
        externalFundingResult: txResult
      });

      const result = await service.signAndBroadcastWithFundingWallet(messages);

      expect(externalSignerHttpSdkService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages);
      expect(fundingSigningClient.signAndBroadcast).not.toHaveBeenCalled();
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

    it("delegates to external signer when feature flag is enabled", async () => {
      const derivationIndex = 1;
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
        hash: "external-derived-hash",
        rawLog: "success"
      });

      const { service, batchSigningClientServiceFactory, externalSignerHttpSdkService } = setup({
        featureFlagsEnabled: true,
        externalDerivedResult: txResult
      });

      const result = await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);

      expect(externalSignerHttpSdkService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith(derivationIndex, messages, options);
      expect(batchSigningClientServiceFactory).not.toHaveBeenCalled();
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
    featureFlagsEnabled?: boolean;
    externalFundingResult?: IndexedTx;
    externalDerivedResult?: IndexedTx;
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
    const featureFlagsService = mock<FeatureFlagsService>({
      isEnabled: jest.fn().mockReturnValue(input?.featureFlagsEnabled ?? false)
    });
    const externalSignerHttpSdkService = mock<ExternalSignerHttpSdkService>({
      signAndBroadcastWithFundingWallet: jest.fn().mockResolvedValue(
        input?.externalFundingResult ??
          mock<IndexedTx>({
            code: 0,
            hash: "external-default-hash",
            rawLog: "success"
          })
      ),
      signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue(
        input?.externalDerivedResult ??
          mock<IndexedTx>({
            code: 0,
            hash: "external-default-hash",
            rawLog: "success"
          })
      )
    });

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

    const service = new TxManagerService(walletResources, batchSigningClientServiceFactory, logger, featureFlagsService, externalSignerHttpSdkService);

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
      logger,
      externalSignerHttpSdkService
    };
  }
});
