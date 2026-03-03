import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { mock } from "vitest-mock-extended";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { ExternalSignerHttpSdkService } from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import type { LoggerService } from "@src/core";
import { TxManagerService } from "./tx-manager.service";

import { createAkashAddress } from "@test/seeders";

describe(TxManagerService.name, () => {
  describe("signAndBroadcastWithFundingWallet", () => {
    it("delegates to external signer", async () => {
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const txResult = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      const { service, externalSignerHttpSdkService } = setup({
        externalFundingResult: txResult
      });

      const result = await service.signAndBroadcastWithFundingWallet(messages);

      expect(externalSignerHttpSdkService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages);
      expect(result).toEqual(txResult);
    });
  });

  describe("getFundingWalletAddress", () => {
    it("returns funding wallet address", async () => {
      const address = createAkashAddress();
      const { service, fundingWallet } = setup({ fundingWalletAddress: address });

      const result = await service.getFundingWalletAddress();

      expect(fundingWallet.getFirstAddress).toHaveBeenCalled();
      expect(result).toBe(address);
    });
  });

  describe("signAndBroadcastWithDerivedWallet", () => {
    it("delegates to external signer", async () => {
      const derivationIndex = 1;
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const options: SignAndBroadcastOptions = { fee: { granter: createAkashAddress() } };
      const txResult = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      const { service, externalSignerHttpSdkService } = setup({
        externalDerivedResult: txResult
      });

      const result = await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);

      expect(externalSignerHttpSdkService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith(derivationIndex, messages, options);
      expect(result).toEqual(txResult);
    });
  });

  describe("getDerivedWalletAddress", () => {
    it("returns derived wallet address for given index", async () => {
      const index = 5;
      const address = createAkashAddress();
      const { service, derivedWallet } = setup({ derivedWalletAddress: address });

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
    externalFundingResult?: IndexedTx;
    externalDerivedResult?: IndexedTx;
  }) {
    const fundingWallet = mock<Wallet>({
      getFirstAddress: jest.fn().mockResolvedValue(input?.fundingWalletAddress ?? createAkashAddress())
    });

    const derivedWallet = mock<Wallet>({
      getFirstAddress: jest.fn().mockResolvedValue(input?.derivedWalletAddress ?? createAkashAddress())
    });

    const walletFactory = jest.fn().mockReturnValue(derivedWallet);

    const walletResources = {
      v1: {
        masterWallet: fundingWallet,
        derivedWalletFactory: walletFactory
      },
      v2: {
        masterWallet: fundingWallet,
        derivedWalletFactory: walletFactory
      }
    };

    const logger = mock<LoggerService>();
    const externalSignerHttpSdkService = mock<ExternalSignerHttpSdkService>({
      signAndBroadcastWithFundingWallet: jest
        .fn()
        .mockResolvedValue(input?.externalFundingResult ?? mock<IndexedTx>({ code: 0, hash: "default-hash", rawLog: "success" })),
      signAndBroadcastWithDerivedWallet: jest
        .fn()
        .mockResolvedValue(input?.externalDerivedResult ?? mock<IndexedTx>({ code: 0, hash: "default-hash", rawLog: "success" }))
    });

    const service = new TxManagerService(walletResources, logger, externalSignerHttpSdkService);

    return {
      service,
      fundingWallet,
      derivedWallet,
      walletFactory,
      logger,
      externalSignerHttpSdkService
    };
  }
});
