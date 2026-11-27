import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import type { CoreConfig } from "@src/core/config/env.config";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { FundingWalletRegistryService } from "./funding-wallet-registry.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(FundingWalletRegistryService.name, () => {
  it("answers reads with the configured wallet and registers nothing before a first grant", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet } = await seedUserWithWallet();

    await expect(service.getActiveAddress()).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletId(wallet.id)).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletAddress(wallet.address!)).resolves.toBe(configuredAddress);

    await expect(repository.findActiveOrAny(network)).resolves.toBeUndefined();
  });

  it("registers the configured wallet on a first grant and puts the existing user wallets on it", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet: bystander } = await seedUserWithWallet();
    const { wallet: granted } = await seedUserWithWallet();

    await expect(service.assignGranterAddress(granted.id)).resolves.toBe(configuredAddress);
    await expect(service.assignGranterAddress(granted.id)).resolves.toBe(configuredAddress);

    await expect(countFundingWallets(network)).resolves.toBe(1);
    await expect(repository.findActive(network)).resolves.toMatchObject({ network, address: configuredAddress, status: "active" });
    await expect(repository.findGranterOf(granted.id, network)).resolves.toMatchObject({ address: configuredAddress });
    await expect(repository.findGranterOf(bystander.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("registers one wallet when several first grants arrive at the same moment", async () => {
    const { service, network, configuredAddress } = setup();
    const wallets = await seedUserWallets(8);

    const addresses = await Promise.all(wallets.map(wallet => service.assignGranterAddress(wallet.id)));

    expect(addresses).toEqual(wallets.map(() => configuredAddress));
    await expect(countFundingWallets(network)).resolves.toBe(1);
  });

  it("assigns from as many open transactions as the pool has connections, each on the connection it already holds", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const txService = container.resolve(TxService);
    const poolSize = container.resolve(CoreConfigService).get("POSTGRES_MAX_CONNECTIONS");
    const wallets = await seedUserWallets(poolSize);
    let openTransactions = 0;
    let announceEveryConnectionHeld = () => {};
    const everyConnectionHeld = new Promise<void>(resolve => (announceEveryConnectionHeld = resolve));

    const addresses = await Promise.all(
      wallets.map(wallet =>
        txService.transaction(async () => {
          await txService.getPgTx()!.execute(sql`SELECT 1`);
          if (++openTransactions === poolSize) announceEveryConnectionHeld();
          await everyConnectionHeld;

          return await service.assignGranterAddress(wallet.id);
        })
      )
    );

    expect(addresses).toEqual(wallets.map(() => configuredAddress));
    await expect(repository.findGranterOf(wallets[poolSize - 1].id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("rolls the registration and the assignment back with the caller\x27s transaction, and makes them again on the next grant", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet } = await seedUserWithWallet();

    await expect(
      container.resolve(TxService).transaction(async () => {
        await service.assignGranterAddress(wallet.id);
        throw new Error("rolled back");
      })
    ).rejects.toThrow("rolled back");

    await expect(repository.findActiveOrAny(network)).resolves.toBeUndefined();
    await expect(repository.findGranterOf(wallet.id, network)).resolves.toBeUndefined();

    await expect(service.assignGranterAddress(wallet.id)).resolves.toBe(configuredAddress);
    await expect(repository.findGranterOf(wallet.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("keeps a user wallet on its first funding wallet after another one becomes active", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet: existing } = await seedUserWithWallet();
    const { wallet: bystander } = await seedUserWithWallet();
    await service.assignGranterAddress(existing.id);
    const { wallet: lateComer } = await seedUserWithWallet();
    const promoted = await promote(network, createAkashAddress());

    await expect(service.getActiveAddress()).resolves.toBe(promoted.address);
    await expect(service.getGranterAddressByWalletId(existing.id)).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletAddress(existing.address!)).resolves.toBe(configuredAddress);
    await expect(service.assignGranterAddress(existing.id)).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletId(bystander.id)).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletId(lateComer.id)).resolves.toBe(promoted.address);
    await expect(service.getGranterAddressByWalletAddress(lateComer.address!)).resolves.toBe(promoted.address);
    await expect(service.assignGranterAddress(lateComer.id)).resolves.toBe(promoted.address);
    await expect(repository.findGranterOf(lateComer.id, network)).resolves.toMatchObject({ id: promoted.id });
  });

  it("registers and assigns while the caller\x27s transaction holds a user wallet locked", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet } = await seedUserWithWallet();
    const userWallets = resolveTable("UserWallets");

    await container.resolve(TxService).transaction(async () => {
      await container.resolve(TxService).getPgTx()!.select().from(userWallets).where(eq(userWallets.id, wallet.id)).for("update");

      await expect(service.assignGranterAddress(wallet.id)).resolves.toBe(configuredAddress);
    });

    await expect(repository.findGranterOf(wallet.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("puts a user wallet on the registered wallet while another transaction holds that user wallet locked", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const txService = container.resolve(TxService);
    const { wallet: lockedElsewhere } = await seedUserWithWallet();
    const { wallet: granted } = await seedUserWithWallet();
    const userWallets = resolveTable("UserWallets");
    let releaseLock = () => {};
    const lockMayEnd = new Promise<void>(resolve => (releaseLock = resolve));
    let announceLocked = () => {};
    const locked = new Promise<void>(resolve => (announceLocked = resolve));

    const lockHolder = txService.transaction(async () => {
      await txService.getPgTx()!.select().from(userWallets).where(eq(userWallets.id, lockedElsewhere.id)).for("update");
      announceLocked();
      await lockMayEnd;
    });
    await locked;

    try {
      await expect(service.assignGranterAddress(granted.id)).resolves.toBe(configuredAddress);
      await expect(repository.findGranterOf(lockedElsewhere.id, network)).resolves.toMatchObject({ address: configuredAddress });
    } finally {
      releaseLock();
      await lockHolder;
    }
  });

  it("refuses rather than registering the configured wallet again when the network has no active wallet", async () => {
    const { service, repository, network } = setup();
    const { wallet } = await seedUserWithWallet();
    await repository.create({ network, address: createAkashAddress(), status: "draining" });

    await expect(service.getActiveAddress()).rejects.toMatchObject({ status: 503 });
    await expect(service.assignGranterAddress(wallet.id)).rejects.toMatchObject({ status: 503 });

    await expect(repository.findActive(network)).resolves.toBeUndefined();
    await expect(countFundingWallets(network)).resolves.toBe(1);
  });

  async function seedUserWallets(count: number) {
    return (await Promise.all(Array.from({ length: count }, () => seedUserWithWallet()))).map(({ wallet }) => wallet);
  }

  async function countFundingWallets(network: string) {
    const fundingWallets = resolveTable("FundingWallets");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).$count(fundingWallets, eq(fundingWallets.network, network));
  }

  async function promote(network: string, address: string) {
    const repository = container.resolve(FundingWalletRepository);
    const fundingWallets = resolveTable("FundingWallets");
    await container.resolve<ApiPgDatabase>(POSTGRES_DB).update(fundingWallets).set({ status: "draining" }).where(eq(fundingWallets.network, network));

    return await repository.create({ network, address, status: "active" });
  }

  function setup() {
    const network = `net-${faker.string.alphanumeric(12)}` as CoreConfig["NETWORK"];
    const configuredAddress = createAkashAddress();
    const repository = container.resolve(FundingWalletRepository);
    const txManagerService = mock<TxManagerService>();
    const featureFlagsService = mock<FeatureFlagsService>();

    txManagerService.getFundingWalletAddress.mockResolvedValue(configuredAddress);
    featureFlagsService.isEnabledForSubject.mockReturnValue(true);

    const service = new FundingWalletRegistryService(
      repository,
      txManagerService,
      featureFlagsService,
      mockConfigService<CoreConfigService>({ NETWORK: network }),
      container.resolve(TxService)
    );

    return { service, repository, network, configuredAddress };
  }
});
