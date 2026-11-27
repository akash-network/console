import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { FundingWalletMoveQueueService } from "@src/billing/services/funding-wallet-move-queue/funding-wallet-move-queue.service";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { CreateLogger } from "@src/core";
import type { CoreConfig } from "@src/core/config/env.config";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { FundingWalletRotationService } from "./funding-wallet-rotation.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(FundingWalletRotationService.name, () => {
  it("adds a standby next to the configured wallet, which it registers as active with the existing users on it", async () => {
    const { rotation, repository, network, configuredAddress } = setup();
    const { wallet } = await seedUserWithWallet();
    const standbyAddress = createAkashAddress();

    await expect(rotation.addStandby(standbyAddress)).resolves.toMatchObject({ address: standbyAddress, status: "standby" });
    await expect(rotation.addStandby(standbyAddress)).resolves.toMatchObject({ address: standbyAddress, status: "standby" });

    await expect(repository.findActive(network)).resolves.toMatchObject({ address: configuredAddress });
    await expect(repository.findByStatus(network, "standby")).resolves.toHaveLength(1);
    await expect(repository.findGranterOf(wallet.id, network)).resolves.toMatchObject({ address: configuredAddress });
  });

  it("refuses the configured wallet as its own standby", async () => {
    const { rotation, configuredAddress } = setup();

    await expect(rotation.addStandby(configuredAddress)).rejects.toMatchObject({ status: 409 });
  });

  it("promotes the standby: new users go to it, existing users stay on the wallet that now drains and get no new grant from it", async () => {
    const { rotation, registry, repository, network, configuredAddress } = setup();
    const { wallet: existing } = await seedUserWithWallet();
    const standbyAddress = createAkashAddress();
    await rotation.addStandby(standbyAddress);

    const promotion = await rotation.promote(standbyAddress);
    const { wallet: lateComer } = await seedUserWithWallet();

    expect(promotion).toMatchObject({ active: { address: standbyAddress, status: "active" }, draining: { address: configuredAddress, status: "draining" } });
    await expect(repository.findByStatus(network, "draining")).resolves.toEqual([expect.objectContaining({ address: configuredAddress })]);
    await expect(registry.getActiveAddress()).resolves.toBe(standbyAddress);
    await expect(registry.getGranterAddressByWalletId(existing.id)).resolves.toBe(configuredAddress);
    await expect(registry.assignGranterAddress(existing.id)).rejects.toMatchObject({ status: 503 });
    await expect(registry.assignGranterAddress(lateComer.id)).resolves.toBe(standbyAddress);
  });

  it("refuses a second promotion while the first replaced wallet still drains, and changes nothing", async () => {
    const { rotation, repository, network } = setup();
    const first = createAkashAddress();
    const second = createAkashAddress();
    await rotation.addStandby(first);
    await rotation.addStandby(second);
    await rotation.promote(first);

    await expect(rotation.promote(second)).rejects.toMatchObject({ status: 409 });

    await expect(repository.findActive(network)).resolves.toMatchObject({ address: first });
    await expect(repository.findByAddress(network, second)).resolves.toMatchObject({ status: "standby" });
  });

  it("promotes once when the same promotion is asked for twice at the same moment", async () => {
    const { rotation, repository, network } = setup();
    const standbyAddress = createAkashAddress();
    await rotation.addStandby(standbyAddress);

    const outcomes = await Promise.allSettled([rotation.promote(standbyAddress), rotation.promote(standbyAddress)]);

    expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
    await expect(repository.findActive(network)).resolves.toMatchObject({ address: standbyAddress });
    await expect(repository.findByStatus(network, "draining")).resolves.toHaveLength(1);
  });

  it("leaves another network's wallets alone", async () => {
    const one = setup();
    const other = setup();
    const standbyAddress = createAkashAddress();
    await one.rotation.addStandby(standbyAddress);
    await other.rotation.addStandby(createAkashAddress());

    await one.rotation.promote(standbyAddress);

    await expect(other.repository.findActive(other.network)).resolves.toMatchObject({ address: other.configuredAddress });
    await expect(other.repository.findByStatus(other.network, "draining")).resolves.toEqual([]);
  });

  function setup() {
    const network = `net-${faker.string.alphanumeric(12)}` as CoreConfig["NETWORK"];
    const configuredAddress = createAkashAddress();
    const repository = container.resolve(FundingWalletRepository);
    const txManagerService = mock<TxManagerService>();
    const featureFlagsService = mock<FeatureFlagsService>();
    const coreConfigService = mockConfigService<CoreConfigService>({ NETWORK: network });
    const txService = container.resolve(TxService);

    txManagerService.getFundingWalletAddress.mockResolvedValue(configuredAddress);
    featureFlagsService.isEnabledForSubject.mockReturnValue(true);

    const registry = new FundingWalletRegistryService(
      repository,
      txManagerService,
      featureFlagsService,
      coreConfigService,
      txService,
      mock<FundingWalletMoveQueueService>()
    );
    const rotation = new FundingWalletRotationService(
      repository,
      registry,
      coreConfigService,
      txService,
      vi.fn<CreateLogger>(() => mock<ReturnType<CreateLogger>>())
    );

    return { rotation, registry, repository, network, configuredAddress };
  }
});
