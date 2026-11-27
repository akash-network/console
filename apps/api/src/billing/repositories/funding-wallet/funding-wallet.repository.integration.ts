import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { FundingWalletRepository } from "./funding-wallet.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(FundingWalletRepository.name, () => {
  describe("create", () => {
    it("registers a wallet and returns it", async () => {
      const { repository, network } = setup();
      const address = createAkashAddress();

      const wallet = await repository.create({ network, address, status: "standby" });

      expect(wallet).toEqual({ id: expect.any(String), network, address, status: "standby" });
    });

    it("refuses a second active wallet on the same network", async () => {
      const { repository, network } = setup();
      await repository.create({ network, address: createAkashAddress(), status: "active" });

      await expect(repository.create({ network, address: createAkashAddress(), status: "active" })).rejects.toThrow();
    });

    it("refuses the same address twice on one network", async () => {
      const { repository, network } = setup();
      const address = createAkashAddress();
      await repository.create({ network, address, status: "active" });

      await expect(repository.create({ network, address, status: "standby" })).rejects.toThrow();
    });

    it("accepts the same address on another network", async () => {
      const { repository, network } = setup();
      const address = createAkashAddress();
      await repository.create({ network, address, status: "active" });

      await expect(repository.create({ network: uniqueNetwork(), address, status: "active" })).resolves.toMatchObject({ address, status: "active" });
    });
  });

  describe("findActive", () => {
    it("finds the active wallet among the network's wallets", async () => {
      const { repository, network } = setup();
      await repository.create({ network, address: createAkashAddress(), status: "draining" });
      const active = await repository.create({ network, address: createAkashAddress(), status: "active" });
      await repository.create({ network, address: createAkashAddress(), status: "standby" });

      await expect(repository.findActive(network)).resolves.toEqual(active);
    });

    it("finds nothing when the only active wallet belongs to another network", async () => {
      const { repository, network } = setup();
      await repository.create({ network: uniqueNetwork(), address: createAkashAddress(), status: "active" });
      await repository.create({ network, address: createAkashAddress(), status: "standby" });

      await expect(repository.findActive(network)).resolves.toBeUndefined();
    });
  });

  describe("hasAny", () => {
    it("answers true for a network with a wallet in any state", async () => {
      const { repository, network } = setup();
      await repository.create({ network, address: createAkashAddress(), status: "retired" });

      await expect(repository.hasAny(network)).resolves.toBe(true);
    });

    it("answers false for a network without wallets, whatever other networks have", async () => {
      const { repository, network } = setup();
      await repository.create({ network: uniqueNetwork(), address: createAkashAddress(), status: "active" });

      await expect(repository.hasAny(network)).resolves.toBe(false);
    });
  });

  describe("assignUnlessAssigned", () => {
    it("records the funding wallet as the user wallet's granter", async () => {
      const { repository, network } = setup();
      const fundingWallet = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const { wallet } = await seedUserWithWallet();

      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: fundingWallet.id });

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toEqual(fundingWallet);
    });

    it("keeps the granter a user wallet already has", async () => {
      const { repository, network } = setup();
      const first = await repository.create({ network, address: createAkashAddress(), status: "draining" });
      const second = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const { wallet } = await seedUserWithWallet();
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: first.id });

      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: second.id });

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toEqual(first);
    });

    it("keeps a granter per network for the same user wallet", async () => {
      const { repository, network } = setup();
      const otherNetwork = uniqueNetwork();
      const here = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const there = await repository.create({ network: otherNetwork, address: createAkashAddress(), status: "active" });
      const { wallet } = await seedUserWithWallet();

      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: here.id });
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network: otherNetwork, fundingWalletId: there.id });

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toEqual(here);
      await expect(repository.findGranterOf(wallet.id, otherNetwork)).resolves.toEqual(there);
    });
  });

  describe("findGranterOf", () => {
    it("finds nothing for a user wallet that was never assigned", async () => {
      const { repository, network } = setup();
      await repository.create({ network, address: createAkashAddress(), status: "active" });
      const { wallet } = await seedUserWithWallet();

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toBeUndefined();
    });
  });

  describe("findGranterOfAddress", () => {
    it("finds the granter of the user wallet at that address on the given network only", async () => {
      const { repository, network } = setup();
      const fundingWallet = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const { wallet, address } = await seedUserWithWallet();
      const other = await seedUserWithWallet();
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: fundingWallet.id });

      await expect(repository.findGranterOfAddress(address, network)).resolves.toEqual(fundingWallet);
      await expect(repository.findGranterOfAddress(address, uniqueNetwork())).resolves.toBeUndefined();
      await expect(repository.findGranterOfAddress(other.address, network)).resolves.toBeUndefined();
    });

    it("finds nothing for an address no user wallet has", async () => {
      const { repository, network } = setup();
      await repository.create({ network, address: createAkashAddress(), status: "active" });

      await expect(repository.findGranterOfAddress(createAkashAddress(), network)).resolves.toBeUndefined();
    });
  });

  describe("assignInitializedUserWallets", () => {
    it("assigns every user wallet that has an address and skips one that has none", async () => {
      const { repository, network } = setup();
      const fundingWallet = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const initialized = await seedUserWithWallet();
      const addressless = await seedUserWithWallet({ address: null });

      await repository.assignInitializedUserWallets({ network, fundingWalletId: fundingWallet.id });

      await expect(repository.findGranterOf(initialized.wallet.id, network)).resolves.toEqual(fundingWallet);
      await expect(repository.findGranterOf(addressless.wallet.id, network)).resolves.toBeUndefined();
    });

    it("leaves a user wallet on the granter it already has", async () => {
      const { repository, network } = setup();
      const earlier = await repository.create({ network, address: createAkashAddress(), status: "draining" });
      const later = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const { wallet } = await seedUserWithWallet();
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: earlier.id });

      await repository.assignInitializedUserWallets({ network, fundingWalletId: later.id });

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toEqual(earlier);
    });

    it("assigns nothing on another network", async () => {
      const { repository, network } = setup();
      const fundingWallet = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const { wallet } = await seedUserWithWallet();

      await repository.assignInitializedUserWallets({ network, fundingWalletId: fundingWallet.id });

      await expect(repository.findGranterOf(wallet.id, uniqueNetwork())).resolves.toBeUndefined();
    });
  });

  describe("lockNetwork", () => {
    it("makes a second transaction on the same network wait for the first to end", async () => {
      const { repository, network } = setup();
      const txService = container.resolve(TxService);
      const order: string[] = [];
      let releaseFirst = () => {};
      const firstMayEnd = new Promise<void>(resolve => (releaseFirst = resolve));
      let announceFirstLocked = () => {};
      const firstLocked = new Promise<void>(resolve => (announceFirstLocked = resolve));

      const first = txService.transaction(async () => {
        await repository.lockNetwork(network);
        announceFirstLocked();
        await firstMayEnd;
        order.push("first ended");
      });
      await firstLocked;
      const second = txService.outsideTransaction(() =>
        txService.transaction(async () => {
          await repository.lockNetwork(network);
          order.push("second locked");
        })
      );
      await new Promise(resolve => setTimeout(resolve, 200));
      releaseFirst();
      await Promise.all([first, second]);

      expect(order).toEqual(["first ended", "second locked"]);
    });

    it("does not make a transaction on another network wait", async () => {
      const { repository, network } = setup();
      const txService = container.resolve(TxService);
      let releaseFirst = () => {};
      const firstMayEnd = new Promise<void>(resolve => (releaseFirst = resolve));
      let announceFirstLocked = () => {};
      const firstLocked = new Promise<void>(resolve => (announceFirstLocked = resolve));

      const first = txService.transaction(async () => {
        await repository.lockNetwork(network);
        announceFirstLocked();
        await firstMayEnd;
      });
      await firstLocked;

      await expect(
        txService.outsideTransaction(() => txService.transaction(async () => await repository.lockNetwork(uniqueNetwork())))
      ).resolves.toBeUndefined();

      releaseFirst();
      await first;
    });
  });

  function uniqueNetwork() {
    return `net-${faker.string.alphanumeric(12)}`;
  }

  function setup() {
    return { repository: container.resolve(FundingWalletRepository), network: uniqueNetwork() };
  }
});
