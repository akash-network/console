import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";

import { type ApiTransaction, TxService } from "@src/core/services/tx/tx.service";
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

  describe("findActiveOrAny", () => {
    it("finds the active wallet when the network has wallets in other states too", async () => {
      const { repository, network } = setup();
      await repository.create({ network, address: createAkashAddress(), status: "draining" });
      const active = await repository.create({ network, address: createAkashAddress(), status: "active" });
      await repository.create({ network, address: createAkashAddress(), status: "standby" });

      await expect(repository.findActiveOrAny(network)).resolves.toEqual(active);
    });

    it("finds a wallet in another state when the network has no active one", async () => {
      const { repository, network } = setup();
      const draining = await repository.create({ network, address: createAkashAddress(), status: "draining" });

      await expect(repository.findActiveOrAny(network)).resolves.toEqual(draining);
    });

    it("finds nothing for a network without wallets, whatever other networks have", async () => {
      const { repository, network } = setup();
      await repository.create({ network: uniqueNetwork(), address: createAkashAddress(), status: "active" });

      await expect(repository.findActiveOrAny(network)).resolves.toBeUndefined();
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

  describe("findByAddress", () => {
    it("finds the wallet at that address on the given network only", async () => {
      const { repository, network } = setup();
      const address = createAkashAddress();
      const wallet = await repository.create({ network, address, status: "standby" });
      await repository.create({ network, address: createAkashAddress(), status: "active" });

      await expect(repository.findByAddress(network, address)).resolves.toEqual(wallet);
      await expect(repository.findByAddress(uniqueNetwork(), address)).resolves.toBeUndefined();
    });
  });

  describe("findByStatus", () => {
    it("finds the network's wallets in that state", async () => {
      const { repository, network } = setup();
      const draining = await repository.create({ network, address: createAkashAddress(), status: "draining" });
      await repository.create({ network, address: createAkashAddress(), status: "active" });
      await repository.create({ network: uniqueNetwork(), address: createAkashAddress(), status: "draining" });

      await expect(repository.findByStatus(network, "draining")).resolves.toEqual([draining]);
      await expect(repository.findByStatus(network, "retired")).resolves.toEqual([]);
    });
  });

  describe("updateStatus", () => {
    it("changes one wallet's state and returns it", async () => {
      const { repository, network } = setup();
      const wallet = await repository.create({ network, address: createAkashAddress(), status: "active" });
      const untouched = await repository.create({ network, address: createAkashAddress(), status: "standby" });

      await expect(repository.updateStatus(wallet.id, "draining")).resolves.toEqual({ ...wallet, status: "draining" });

      await expect(repository.findByAddress(network, untouched.address)).resolves.toEqual(untouched);
    });

    it("returns nothing for a wallet that does not exist", async () => {
      const { repository } = setup();

      await expect(repository.updateStatus(faker.string.uuid(), "retired")).resolves.toBeUndefined();
    });
  });

  describe("when a user wallet's funding wallet is retired", () => {
    it("reads the user wallet as never assigned, by id and by address", async () => {
      const { repository, network } = setup();
      const { wallet } = await seedUserWithWallet();
      const retired = await repository.create({ network, address: createAkashAddress(), status: "draining" });
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: retired.id });
      await repository.updateStatus(retired.id, "retired");

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toBeUndefined();
      await expect(repository.findGranterOfAddress(wallet.address!, network)).resolves.toBeUndefined();
    });

    it("assigns the user wallet to the funding wallet it is granted from next", async () => {
      const { repository, network } = setup();
      const { wallet } = await seedUserWithWallet();
      const retired = await repository.create({ network, address: createAkashAddress(), status: "retired" });
      const active = await repository.create({ network, address: createAkashAddress(), status: "active" });
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: retired.id });

      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: active.id });

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toEqual(active);
    });

    it("keeps a user wallet on a funding wallet that still drains", async () => {
      const { repository, network } = setup();
      const { wallet } = await seedUserWithWallet();
      const draining = await repository.create({ network, address: createAkashAddress(), status: "draining" });
      const active = await repository.create({ network, address: createAkashAddress(), status: "active" });
      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: draining.id });

      await repository.assignUnlessAssigned({ userWalletId: wallet.id, network, fundingWalletId: active.id });

      await expect(repository.findGranterOf(wallet.id, network)).resolves.toEqual(draining);
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
      let announceFirstLocked = () => {};
      const firstLocked = new Promise<void>(resolve => (announceFirstLocked = resolve));

      const first = txService.transaction(async () => {
        await repository.lockNetwork(network);
        announceFirstLocked();
        await vi.waitFor(async () => expect(await countSessionsWaitingForAnAdvisoryLock(txService.getPgTx()!)).toBe(1), { timeout: 10_000, interval: 50 });
        order.push("first ended");
      });
      await firstLocked;
      const second = txService.outsideTransaction(() =>
        txService.transaction(async () => {
          await repository.lockNetwork(network);
          order.push("second locked");
        })
      );
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

      try {
        await expect(
          txService.outsideTransaction(() => txService.transaction(async () => await repository.lockNetwork(uniqueNetwork())))
        ).resolves.toBeUndefined();
      } finally {
        releaseFirst();
        await first;
      }
    });
  });

  async function countSessionsWaitingForAnAdvisoryLock(lockHolder: ApiTransaction) {
    const [{ waiting }] = await lockHolder.execute<{ waiting: number }>(sql`
      SELECT count(*)::int AS waiting
      FROM pg_locks
      WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
    `);

    return waiting;
  }

  function uniqueNetwork() {
    return `net-${faker.string.alphanumeric(12)}`;
  }

  function setup() {
    return { repository: container.resolve(FundingWalletRepository), network: uniqueNetwork() };
  }
});
