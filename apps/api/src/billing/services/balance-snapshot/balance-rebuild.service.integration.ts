import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BalanceSnapshotRepository } from "@src/billing/repositories/balance-snapshot/balance-snapshot.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import { CHAIN_DB } from "@src/chain";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { BalanceRebuildService } from "./balance-rebuild.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import {
  ensureTransactionEventTables,
  indexAllowanceGrant,
  indexAllowanceRevoke,
  indexGrantFundedDeposit,
  indexGrantRefund
} from "@test/seeders/deployment-allowance-history.seeder";

describe(BalanceRebuildService.name, () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await container.resolve<ApiPgDatabase>(POSTGRES_DB).delete(resolveTable("BalanceSnapshots"));
  });

  it("rebuilds a balance from the snapshot and the deposits, returned escrow and top-ups the chain shows since", async () => {
    const { service, user, granter, denom, takeSnapshot, chain } = await setup();
    const snapshot = await takeSnapshot({ takenOn: "2026-11-27", balances: [{ granter, amount: 1_000_000 }] });
    await indexGrantFundedDeposit({ granter, grantee: user, denom, amount: 300_000, height: snapshot.height });
    await indexGrantFundedDeposit({ granter, grantee: user, denom, amount: 250_000, height: snapshot.height + 3 });
    await indexGrantRefund({ granter, grantee: user, denom, amount: 100_000, height: snapshot.height + 5 });
    await indexAllowanceGrant({ granter, grantee: user, denom, limit: 2_850_000, height: snapshot.height + 8 });
    await indexGrantFundedDeposit({ granter, grantee: user, denom, amount: 50_000, height: snapshot.height + 9 });
    await indexGrantFundedDeposit({ granter, grantee: createAkashAddress(), denom, amount: 999, height: snapshot.height + 9, txIndex: 1 });
    chain.limits.set(granter, 2_800_000);

    await expect(service.rebuild(user)).resolves.toEqual({
      address: user,
      takenOn: "2026-11-27",
      height: snapshot.height,
      rebuiltUpTo: chain.height,
      balances: [{ granter, inSnapshot: 1_000_000, rebuilt: 2_800_000, onChain: 2_800_000, onChainHeight: chain.height }]
    });
  });

  it("shows a grant rewritten on chain as a rebuilt balance next to the one the snapshot held", async () => {
    const { service, user, granter, takeSnapshot, chain } = await setup();
    const snapshot = await takeSnapshot({ takenOn: "2026-11-27", balances: [{ granter, amount: 1_000_000 }] });
    await indexAllowanceRevoke({ granter, grantee: user, height: snapshot.height + 2 });
    chain.limits.set(granter, 0);

    await expect(service.rebuild(user)).resolves.toMatchObject({ balances: [{ granter, inSnapshot: 1_000_000, rebuilt: 0, onChain: 0 }] });
  });

  it("rebuilds from nothing on the funding wallet a user moved to after the snapshot, next to the one the snapshot knew", async () => {
    const { service, user, granter, denom, takeSnapshot, chain } = await setup();
    const movedTo = createAkashAddress();
    const snapshot = await takeSnapshot({ takenOn: "2026-11-27", balances: [{ granter, amount: 1_000_000 }] });
    await indexAllowanceRevoke({ granter, grantee: user, height: snapshot.height + 2 });
    await indexAllowanceGrant({ granter: movedTo, grantee: user, denom, limit: 1_000_000, height: snapshot.height + 3 });
    chain.currentGranter = movedTo;
    chain.limits.set(movedTo, 1_000_000);

    const rebuilt = await service.rebuild(user);

    expect(rebuilt.balances).toEqual([
      { granter, inSnapshot: 1_000_000, rebuilt: 0, onChain: 0, onChainHeight: chain.height },
      { granter: movedTo, inSnapshot: 0, rebuilt: 1_000_000, onChain: 1_000_000, onChainHeight: chain.height }
    ]);
  });

  it("starts from the snapshot of the day asked for rather than the latest", async () => {
    const { service, user, granter, takeSnapshot } = await setup();
    const earlier = await takeSnapshot({ takenOn: "2026-11-26", balances: [{ granter, amount: 400_000 }] });
    await takeSnapshot({ takenOn: "2026-11-27", balances: [{ granter, amount: 900_000 }], height: earlier.height + 14_400 });

    await expect(service.rebuild(user, "2026-11-26")).resolves.toMatchObject({
      takenOn: "2026-11-26",
      height: earlier.height,
      balances: [{ granter, inSnapshot: 400_000, rebuilt: 400_000 }]
    });
    await expect(service.rebuild(user)).resolves.toMatchObject({ takenOn: "2026-11-27", balances: [{ granter, inSnapshot: 900_000 }] });
  });

  it("refuses a day whose snapshot is missing or was never completed", async () => {
    const { service, user, network, takeSnapshot } = await setup();
    await takeSnapshot({ takenOn: "2026-11-27", balances: [], isComplete: false });

    await expect(service.rebuild(user, "2026-11-27")).rejects.toMatchObject({
      status: 404,
      message: "No complete balance snapshot was taken on 2026-11-27",
      network
    });
    await expect(service.rebuild(user, "2026-11-20")).rejects.toMatchObject({ status: 404 });
    await expect(service.rebuild(user)).rejects.toMatchObject({ status: 404, message: "No complete balance snapshot was taken yet" });
  });

  async function setup() {
    container.resolve(CHAIN_DB);
    await ensureTransactionEventTables();
    const network = container.resolve(CoreConfigService).get("NETWORK");
    const denom = container.resolve(BillingConfigService).get("DEPLOYMENT_GRANT_DENOM");
    const user = createAkashAddress();
    const granter = createAkashAddress();
    const baseHeight = faker.number.int({ min: 50_000_000, max: 1_900_000_000 });
    const chain = { height: baseHeight + 20_000, currentGranter: granter, limits: new Map<string, number>() };

    vi.spyOn(container.resolve(BlockHttpService), "getFreshCurrentHeight").mockImplementation(async () => chain.height);
    vi.spyOn(container.resolve(FundingWalletRegistryService), "getGranterAddressByWalletAddress").mockImplementation(async () => chain.currentGranter);
    vi.spyOn(container.resolve(BalancesService), "retrieveDeploymentLimitAtLatestHeight").mockImplementation(async (_wallet, options) => ({
      limit: chain.limits.get(options!.granter!) ?? 0,
      height: chain.height,
      granter: options!.granter!
    }));

    const takeSnapshot = async (input: { takenOn: string; balances: { granter: string; amount: number }[]; height?: number; isComplete?: boolean }) => {
      const repository = container.resolve(BalanceSnapshotRepository);
      const snapshot = (await repository.startUnlessComplete({ network, takenOn: input.takenOn, height: input.height ?? baseHeight }))!;
      await repository.addGrants(snapshot.id, [
        ...input.balances.map(balance => ({ ...balance, grantee: user, denom })),
        { granter, grantee: createAkashAddress(), denom, amount: 123 },
        { granter, grantee: user, denom: "uother", amount: 77 }
      ]);

      if (input.isComplete !== false) await repository.complete(snapshot.id, input.balances.length + 2);

      return snapshot;
    };

    return { service: container.resolve(BalanceRebuildService), network, denom, user, granter, chain, takeSnapshot };
  }
});
