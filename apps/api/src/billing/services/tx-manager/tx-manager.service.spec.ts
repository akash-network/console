import { Bip39, Random } from "@cosmjs/crypto";
import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import type { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import type { ExternalSignerHttpSdkService } from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import type { CreateLogger } from "@src/core";
import { createWalletResources, TxManagerService } from "./tx-manager.service";

import { createAkashAddress } from "@test/seeders";

describe(TxManagerService.name, () => {
  describe("signAndBroadcastWithFundingWallet", () => {
    it("delegates to external signer, naming the grantee by its index and the seed version its wallet records", async () => {
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const txResult = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      const { service, externalSignerHttpSdkService, userWalletRepository } = setup({ externalFundingResult: txResult, seedVersion: "v3" });

      const result = await service.signAndBroadcastWithFundingWallet(messages, { granteeDerivationIndex: 7 });

      expect(userWalletRepository.findSeedVersionById).toHaveBeenCalledWith(7);
      expect(externalSignerHttpSdkService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages, { derivationIndex: 7, seedVersion: "v3" });
      expect(result).toEqual(txResult);
    });

    it("delegates to external signer without a grantee when none is named", async () => {
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const { service, externalSignerHttpSdkService, userWalletRepository } = setup();

      await service.signAndBroadcastWithFundingWallet(messages);

      expect(externalSignerHttpSdkService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages, undefined);
      expect(userWalletRepository.findSeedVersionById).not.toHaveBeenCalled();
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
    it("delegates to external signer, naming the wallet by its index and the seed version it records", async () => {
      const derivationIndex = 1;
      const messages: EncodeObject[] = [{ typeUrl: "/test.MsgTest", value: {} }];
      const options: SignAndBroadcastOptions = { fee: { granter: createAkashAddress() } };
      const txResult = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      const { service, externalSignerHttpSdkService } = setup({ externalDerivedResult: txResult, seedVersion: "v3" });

      const result = await service.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);

      expect(externalSignerHttpSdkService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith({ derivationIndex, seedVersion: "v3" }, messages, options);
      expect(result).toEqual(txResult);
    });
  });

  describe("getSeedVersion", () => {
    it("reads the seed version the wallet row records, once per wallet", async () => {
      const { service, userWalletRepository } = setup({ seedVersion: "v3" });

      await expect(service.getSeedVersion(11)).resolves.toBe("v3");
      await expect(service.getSeedVersion(11)).resolves.toBe("v3");
      await expect(service.getSeedVersion(12)).resolves.toBe("v3");

      expect(userWalletRepository.findSeedVersionById.mock.calls).toEqual([[11], [12]]);
    });

    it("keeps the version of one wallet apart from another's", async () => {
      const { service, userWalletRepository } = setup();
      userWalletRepository.findSeedVersionById.mockImplementation(async id => (id === 11 ? "v2" : "v3"));

      await service.getSeedVersion(11);
      await service.getSeedVersion(12);

      await expect(service.getSeedVersion(11)).resolves.toBe("v2");
      await expect(service.getSeedVersion(12)).resolves.toBe("v3");
    });

    it("fails for a wallet that does not exist, and looks again the next time", async () => {
      const { service, userWalletRepository } = setup();
      userWalletRepository.findSeedVersionById.mockResolvedValueOnce(undefined);

      await expect(service.getSeedVersion(11)).rejects.toThrow("Wallet 11 does not exist, so the seed it was derived from is unknown");
      await expect(service.getSeedVersion(11)).resolves.toBe("v2");
    });
  });

  describe("getDerivedWalletAddress", () => {
    it("asks the signer for the address of a wallet made from a seed this process does not hold", async () => {
      const { service, externalSignerHttpSdkService, currentWalletFactory, earlierWalletFactory } = setup({ seedVersion: "v3" });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getDerivedWalletAddress.mockResolvedValue(address);

      await expect(service.getDerivedWalletAddress(5)).resolves.toBe(address);

      expect(externalSignerHttpSdkService.getDerivedWalletAddress).toHaveBeenCalledWith({ derivationIndex: 5, seedVersion: "v3" });
      expect(currentWalletFactory).not.toHaveBeenCalled();
      expect(earlierWalletFactory).not.toHaveBeenCalled();
    });

    it("takes a version the caller names over the one the wallet records, without reading the wallet", async () => {
      const { service, userWalletRepository, earlierWalletAddress } = setup({ seedVersion: "v3" });

      await expect(service.getDerivedWalletAddress(5, { walletVersion: "v1" })).resolves.toBe(earlierWalletAddress);

      expect(userWalletRepository.findSeedVersionById).not.toHaveBeenCalled();
    });

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

      expect(externalSignerHttpSdkService.getDerivedWalletAddress).toHaveBeenCalledWith({ derivationIndex: 5, seedVersion: "v2" });
      expect(earlierWalletFactory).not.toHaveBeenCalled();
    });

    it("asks the signer for a first-generation address when it holds no earlier derivation seed", async () => {
      const { service, externalSignerHttpSdkService, currentWalletFactory } = setup({ holdsEarlierDerivationSeed: false });
      const address = createAkashAddress();
      externalSignerHttpSdkService.getDerivedWalletAddress.mockResolvedValue(address);

      await expect(service.getDerivedWalletAddress(5, { walletVersion: "v1" })).resolves.toBe(address);

      expect(externalSignerHttpSdkService.getDerivedWalletAddress).toHaveBeenCalledWith({ derivationIndex: 5, seedVersion: "v1" });
      expect(currentWalletFactory).not.toHaveBeenCalled();
    });
  });

  describe("holdsDerivationSeed", () => {
    it("holds the seeds that are configured and no other", () => {
      const { service } = setup();

      expect(service.holdsDerivationSeed("v1")).toBe(true);
      expect(service.holdsDerivationSeed("v2")).toBe(true);
      expect(service.holdsDerivationSeed("v3")).toBe(false);
    });

    it("does not hold the current seed when only the earlier one is configured", () => {
      const { service } = setup({ holdsDerivationSeed: false });

      expect(service.holdsDerivationSeed("v2")).toBe(false);
      expect(service.holdsDerivationSeed("v1")).toBe(true);
    });
  });

  describe("getDerivedWallet", () => {
    it("returns the wallet at an index of the seed version named", () => {
      const { service, currentWalletFactory, earlierWalletFactory, currentWallet } = setup();

      expect(service.getDerivedWallet(3, "v2")).toBe(currentWallet);
      expect(currentWalletFactory).toHaveBeenCalledWith(3);
      expect(earlierWalletFactory).not.toHaveBeenCalled();
    });

    it.each(["v2", "v3"])("refuses to hand out a wallet of seed %s when this process does not hold it", seedVersion => {
      const { service, earlierWalletFactory } = setup({ holdsDerivationSeed: false });

      expect(() => service.getDerivedWallet(3, seedVersion)).toThrow(
        `This process holds no derivation seed ${seedVersion}, so only the signer can sign for a wallet made from it`
      );
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
    seedVersion?: string;
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

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findSeedVersionById.mockResolvedValue(input?.seedVersion ?? "v2");

    const service = new TxManagerService(walletResources, createLogger, externalSignerHttpSdkService, userWalletRepository);

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
      externalSignerHttpSdkService,
      userWalletRepository
    };
  }
});
