import { Bip39, Random } from "@cosmjs/crypto";
import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import type { ExternalSignerHttpSdkService } from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import type { CreateLogger } from "@src/core";
import { createWalletResources, TxManagerService } from "./tx-manager.service";

import { createAkashAddress } from "@test/seeders";

describe(TxManagerService.name, () => {
  describe("signAndBroadcastWithFundingWallet", () => {
    it("delegates to external signer with the grantee it names", async () => {
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const options = { granteeDerivationIndex: 7 };
      const txResult = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      const { service, externalSignerHttpSdkService } = setup({
        externalFundingResult: txResult
      });

      const result = await service.signAndBroadcastWithFundingWallet(messages, options);

      expect(externalSignerHttpSdkService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages, options);
      expect(result).toEqual(txResult);
    });
  });

  describe("getFundingWalletAddress", () => {
    it("reads the address from the funding seed it holds, without asking the signer", async () => {
      const address = createAkashAddress();
      const { service, externalSignerHttpSdkService } = setup({ fundingWalletAddress: address });

      await expect(service.getFundingWalletAddress()).resolves.toBe(address);

      expect(externalSignerHttpSdkService.getFundingWalletAddresses).not.toHaveBeenCalled();
    });

    it("takes the first funding wallet the signer names when it holds no funding seed", async () => {
      const { service, externalSignerHttpSdkService } = setup({ holdsFundingSeed: false });
      const [seedPhraseWalletAddress, keyServiceWalletAddress] = [createAkashAddress(), createAkashAddress()];
      externalSignerHttpSdkService.getFundingWalletAddresses.mockResolvedValue([seedPhraseWalletAddress, keyServiceWalletAddress]);

      await expect(service.getFundingWalletAddress()).resolves.toBe(seedPhraseWalletAddress);
    });

    it("asks the signer once, however often and however concurrently the address is read", async () => {
      const { service, externalSignerHttpSdkService } = setup({ holdsFundingSeed: false });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getFundingWalletAddresses.mockResolvedValue([address]);

      const addresses = await Promise.all([service.getFundingWalletAddress(), service.getFundingWalletAddress()]);
      addresses.push(await service.getFundingWalletAddress());

      expect(addresses).toEqual([address, address, address]);
      expect(externalSignerHttpSdkService.getFundingWalletAddresses).toHaveBeenCalledTimes(1);
    });

    it("asks the signer again after it failed to answer", async () => {
      const { service, externalSignerHttpSdkService } = setup({ holdsFundingSeed: false });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getFundingWalletAddresses.mockRejectedValueOnce(new Error("signer is down")).mockResolvedValue([address]);

      await expect(service.getFundingWalletAddress()).rejects.toThrow("signer is down");
      await expect(service.getFundingWalletAddress()).resolves.toBe(address);
    });

    it("fails, and asks again later, when the signer names no funding wallet", async () => {
      const { service, externalSignerHttpSdkService } = setup({ holdsFundingSeed: false });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getFundingWalletAddresses.mockResolvedValueOnce([]).mockResolvedValue([address]);

      await expect(service.getFundingWalletAddress()).rejects.toThrow("The signer named no funding wallet");
      await expect(service.getFundingWalletAddress()).resolves.toBe(address);
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
    it("derives the address at an index from the current derivation seed by default", async () => {
      const { service, currentWalletFactory, currentWalletAddress, earlierWalletFactory, externalSignerHttpSdkService } = setup();

      await expect(service.getDerivedWalletAddress(5)).resolves.toBe(currentWalletAddress);

      expect(currentWalletFactory).toHaveBeenCalledWith(5);
      expect(earlierWalletFactory).not.toHaveBeenCalled();
      expect(externalSignerHttpSdkService.getDerivedWalletAddress).not.toHaveBeenCalled();
    });

    it("derives a first-generation address from the earlier derivation seed", async () => {
      const { service, currentWalletFactory, earlierWalletFactory, earlierWalletAddress } = setup();

      await expect(service.getDerivedWalletAddress(5, { walletVersion: "v1" })).resolves.toBe(earlierWalletAddress);

      expect(earlierWalletFactory).toHaveBeenCalledWith(5);
      expect(currentWalletFactory).not.toHaveBeenCalled();
    });

    it("asks the signer for the address when it holds no current derivation seed", async () => {
      const { service, externalSignerHttpSdkService, earlierWalletFactory } = setup({ holdsDerivationSeed: false });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getDerivedWalletAddress.mockResolvedValue(address);

      await expect(service.getDerivedWalletAddress(5)).resolves.toBe(address);

      expect(externalSignerHttpSdkService.getDerivedWalletAddress).toHaveBeenCalledWith(5, "v2");
      expect(earlierWalletFactory).not.toHaveBeenCalled();
    });

    it("asks the signer for a first-generation address when it holds no earlier derivation seed", async () => {
      const { service, externalSignerHttpSdkService, currentWalletFactory } = setup({ holdsEarlierDerivationSeed: false });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getDerivedWalletAddress.mockResolvedValue(address);

      await expect(service.getDerivedWalletAddress(5, { walletVersion: "v1" })).resolves.toBe(address);

      expect(externalSignerHttpSdkService.getDerivedWalletAddress).toHaveBeenCalledWith(5, "v1");
      expect(currentWalletFactory).not.toHaveBeenCalled();
    });
  });

  describe("holdsDerivationSeed", () => {
    it("holds it when the current derivation seed is configured", () => {
      expect(setup().service.holdsDerivationSeed).toBe(true);
    });

    it("does not hold it when only the earlier derivation seed is configured", () => {
      expect(setup({ holdsDerivationSeed: false }).service.holdsDerivationSeed).toBe(false);
    });
  });

  describe("getDerivedWallet", () => {
    it("returns the wallet at an index of the current derivation seed", () => {
      const { service, currentWalletFactory, currentWallet } = setup();

      expect(service.getDerivedWallet(3)).toBe(currentWallet);
      expect(currentWalletFactory).toHaveBeenCalledWith(3);
    });

    it("refuses to hand out a wallet when it holds no current derivation seed", () => {
      const { service, earlierWalletFactory } = setup({ holdsDerivationSeed: false });

      expect(() => service.getDerivedWallet(3)).toThrow("This process holds no derivation seed, so only the signer can sign for a user wallet");
      expect(earlierWalletFactory).not.toHaveBeenCalled();
    });
  });

  describe(createWalletResources.name, () => {
    it("builds each wallet from the seed phrase configured for it", async () => {
      const [funding, earlierDerivation, currentDerivation] = [seedPhrase(), seedPhrase(), seedPhrase()];

      const { fundingWallet, derivedWalletFactories } = createWalletResources({ funding, derivation: { v1: earlierDerivation, v2: currentDerivation } });

      await expect(fundingWallet!.getFirstAddress()).resolves.toBe(await new Wallet(funding).getFirstAddress());
      await expect(derivedWalletFactories.v1!(4).getFirstAddress()).resolves.toBe(await new Wallet(earlierDerivation, 4).getFirstAddress());
      await expect(derivedWalletFactories.v2!(4).getFirstAddress()).resolves.toBe(await new Wallet(currentDerivation, 4).getFirstAddress());
      await expect(derivedWalletFactories.v2!(0).getFirstAddress()).resolves.toBe(await new Wallet(currentDerivation, 0).getFirstAddress());
    });

    it.each([
      ["missing", undefined],
      ["blank", ""]
    ])("builds no wallet from a %s seed phrase, rather than a random one", (_case, absent) => {
      const resources = createWalletResources({ funding: absent, derivation: { v1: absent, v2: absent } });

      expect(resources).toEqual({ fundingWallet: undefined, derivedWalletFactories: { v1: undefined, v2: undefined } });
    });

    function seedPhrase() {
      return Bip39.encode(Random.getBytes(32)).toString();
    }
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TxManagerService.name });
  });

  function setup(input?: {
    fundingWalletAddress?: string;
    holdsFundingSeed?: boolean;
    holdsDerivationSeed?: boolean;
    holdsEarlierDerivationSeed?: boolean;
    externalFundingResult?: IndexedTx;
    externalDerivedResult?: IndexedTx;
  }) {
    const fundingWallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(input?.fundingWalletAddress ?? createAkashAddress())
    });

    const currentWalletAddress = createAkashAddress();
    const currentWallet = mock<Wallet>({ getFirstAddress: vi.fn().mockResolvedValue(currentWalletAddress) });
    const currentWalletFactory = vi.fn().mockReturnValue(currentWallet);

    const earlierWalletAddress = createAkashAddress();
    const earlierWalletFactory = vi.fn().mockReturnValue(mock<Wallet>({ getFirstAddress: vi.fn().mockResolvedValue(earlierWalletAddress) }));

    const walletResources = {
      fundingWallet: input?.holdsFundingSeed === false ? undefined : fundingWallet,
      derivedWalletFactories: {
        v1: input?.holdsEarlierDerivationSeed === false ? undefined : earlierWalletFactory,
        v2: input?.holdsDerivationSeed === false ? undefined : currentWalletFactory
      }
    };

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const externalSignerHttpSdkService = mock<ExternalSignerHttpSdkService>({
      signAndBroadcastWithFundingWallet: vi
        .fn()
        .mockResolvedValue(input?.externalFundingResult ?? mock<IndexedTx>({ code: 0, hash: "default-hash", rawLog: "success" })),
      signAndBroadcastWithDerivedWallet: vi
        .fn()
        .mockResolvedValue(input?.externalDerivedResult ?? mock<IndexedTx>({ code: 0, hash: "default-hash", rawLog: "success" }))
    });

    const service = new TxManagerService(walletResources, createLogger, externalSignerHttpSdkService);

    return {
      service,
      fundingWallet,
      currentWallet,
      currentWalletAddress,
      currentWalletFactory,
      earlierWalletAddress,
      earlierWalletFactory,
      logger,
      createLogger,
      externalSignerHttpSdkService
    };
  }
});
