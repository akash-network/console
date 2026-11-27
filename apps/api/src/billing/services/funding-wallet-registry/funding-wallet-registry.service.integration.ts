import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import type { CoreConfig } from "@src/core/config/env.config";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { FundingWalletRegistryService } from "./funding-wallet-registry.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(FundingWalletRegistryService.name, () => {
  it("registers the configured wallet once and puts the existing user wallets on it", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet } = await seedUserWithWallet();

    await expect(service.getActiveAddress()).resolves.toBe(configuredAddress);
    await expect(service.getActiveAddress()).resolves.toBe(configuredAddress);

    await expect(repository.findActive(network)).resolves.toMatchObject({ network, address: configuredAddress, status: "active" });
    await expect(repository.findGranterOf(wallet.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("registers one wallet when several callers ask at the same moment", async () => {
    const { service, repository, network, configuredAddress } = setup();

    const addresses = await Promise.all(Array.from({ length: 8 }, () => service.getActiveAddress()));

    expect(addresses).toEqual(Array.from({ length: 8 }, () => configuredAddress));
    await expect(repository.findActive(network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("keeps the registration when the caller's own transaction rolls back", async () => {
    const { service, repository, network, configuredAddress } = setup();

    await expect(
      container.resolve(TxService).transaction(async () => {
        await service.getActiveAddress();
        throw new Error("rolled back");
      })
    ).rejects.toThrow("rolled back");

    await expect(repository.findActive(network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("keeps a user wallet on its first funding wallet after another one becomes active", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet: existing } = await seedUserWithWallet();
    await service.getActiveAddress();
    const { wallet: lateComer } = await seedUserWithWallet();
    const promoted = await promote(network, createAkashAddress());

    await expect(service.getGranterAddressByWalletId(existing.id)).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletAddress(existing.address!)).resolves.toBe(configuredAddress);
    await expect(service.assignGranterAddress(existing.id)).resolves.toBe(configuredAddress);
    await expect(service.getGranterAddressByWalletId(lateComer.id)).resolves.toBe(promoted.address);
    await expect(service.getGranterAddressByWalletAddress(lateComer.address!)).resolves.toBe(promoted.address);
    await expect(service.assignGranterAddress(lateComer.id)).resolves.toBe(promoted.address);
    await expect(repository.findGranterOf(lateComer.id, network)).resolves.toMatchObject({ id: promoted.id });
  });

  it("registers and assigns while the caller's transaction holds a user wallet locked", async () => {
    const { service, repository, network, configuredAddress } = setup();
    const { wallet } = await seedUserWithWallet();
    const userWallets = resolveTable("UserWallets");

    await container.resolve(TxService).transaction(async () => {
      await container.resolve(TxService).getPgTx()!.select().from(userWallets).where(eq(userWallets.id, wallet.id)).for("update");

      await expect(service.assignGranterAddress(wallet.id)).resolves.toBe(configuredAddress);
    });

    await expect(repository.findGranterOf(wallet.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("keeps the assignment when the transaction that asked for it rolls back", async () => {
    const { service, repository, network, configuredAddress } = setup();
    await service.getActiveAddress();
    const { wallet } = await seedUserWithWallet();

    await expect(
      container.resolve(TxService).transaction(async () => {
        await service.assignGranterAddress(wallet.id);
        throw new Error("rolled back");
      })
    ).rejects.toThrow("rolled back");

    await expect(repository.findGranterOf(wallet.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("refuses rather than registering the configured wallet again when the network has no active wallet", async () => {
    const { service, repository, network } = setup();
    await repository.create({ network, address: createAkashAddress(), status: "draining" });

    await expect(service.getActiveAddress()).rejects.toMatchObject({ status: 503 });

    await expect(repository.findActive(network)).resolves.toBeUndefined();
  });

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
