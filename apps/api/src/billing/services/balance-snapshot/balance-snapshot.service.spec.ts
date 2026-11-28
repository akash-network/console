import type { AuthzHttpService, DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BalanceSnapshotOutput, BalanceSnapshotRepository } from "@src/billing/repositories/balance-snapshot/balance-snapshot.repository";
import type { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { BalanceSnapshotService } from "./balance-snapshot.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";
const TAKEN_ON = "2026-11-28";
const HEIGHT = 25_000_000;

describe(BalanceSnapshotService.name, () => {
  describe("take", () => {
    it("stores the remaining limit of every grant of the active funding wallet, all read at one height", async () => {
      const { service, active, snapshot, grantees, balanceSnapshotRepository, authzHttpService, logger } = setup({
        grants: { active: [[{ denom: "uact", amount: "1500000" }], [{ denom: "uact", amount: "0" }]] }
      });

      await expect(service.take(TAKEN_ON)).resolves.toEqual({ network: NETWORK, takenOn: TAKEN_ON, height: HEIGHT, grants: 2, isAlreadyComplete: false });

      expect(balanceSnapshotRepository.startUnlessComplete).toHaveBeenCalledWith({ network: NETWORK, takenOn: TAKEN_ON, height: HEIGHT });
      expect(authzHttpService.getPaginatedDepositDeploymentGrants.mock.calls).toEqual([[{ granter: active, limit: 500, offset: 0, height: HEIGHT }]]);
      expect(balanceSnapshotRepository.addGrants).toHaveBeenCalledWith(snapshot.id, [
        { granter: active, grantee: grantees.active[0], denom: "uact", amount: 1_500_000 },
        { granter: active, grantee: grantees.active[1], denom: "uact", amount: 0 }
      ]);
      expect(balanceSnapshotRepository.complete).toHaveBeenCalledWith(snapshot.id, 2);
      expect(balanceSnapshotRepository.fail).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({
        event: "BALANCE_SNAPSHOT_TAKEN",
        network: NETWORK,
        takenOn: TAKEN_ON,
        height: HEIGHT,
        grants: 2,
        isAlreadyComplete: false
      });
    });

    it("stores the grants of the draining funding wallet next to those of the active one while a rotation runs", async () => {
      const { service, active, draining, grantees, snapshot, balanceSnapshotRepository, fundingWalletRepository } = setup({
        grants: { active: [[{ denom: "uact", amount: "100" }]], draining: [[{ denom: "uact", amount: "700" }]] }
      });

      await expect(service.take(TAKEN_ON)).resolves.toMatchObject({ grants: 2 });

      expect(fundingWalletRepository.findDraining).toHaveBeenCalledWith(NETWORK);
      expect(balanceSnapshotRepository.addGrants.mock.calls).toEqual([
        [snapshot.id, [{ granter: active, grantee: grantees.active[0], denom: "uact", amount: 100 }]],
        [snapshot.id, [{ granter: draining, grantee: grantees.draining[0], denom: "uact", amount: 700 }]]
      ]);
    });

    it("stores one balance per denom of a grant, adding up a denom the grant names twice", async () => {
      const { service, active, grantees, snapshot, balanceSnapshotRepository } = setup({
        grants: {
          active: [
            [
              { denom: "uact", amount: "300" },
              { denom: "uakt", amount: "50" },
              { denom: "uact", amount: "200" }
            ]
          ]
        }
      });

      await expect(service.take(TAKEN_ON)).resolves.toMatchObject({ grants: 2 });

      expect(balanceSnapshotRepository.addGrants).toHaveBeenCalledWith(snapshot.id, [
        { granter: active, grantee: grantees.active[0], denom: "uact", amount: 500 },
        { granter: active, grantee: grantees.active[0], denom: "uakt", amount: 50 }
      ]);
    });

    it.each([
      [0, [0]],
      [500, [0]],
      [501, [0, 500]],
      [1001, [0, 500, 1000]]
    ])("reads %i grants a page of 500 at a time", async (count, offsets) => {
      const { service, active, authzHttpService } = setup({
        grants: { active: Array.from({ length: count }, () => [{ denom: "uact" as const, amount: "1" }]) }
      });

      await expect(service.take(TAKEN_ON)).resolves.toMatchObject({ grants: count });

      expect(authzHttpService.getPaginatedDepositDeploymentGrants.mock.calls).toEqual(
        offsets.map(offset => [{ granter: active, limit: 500, offset, height: HEIGHT }])
      );
    });

    it("leaves a day that is already complete as it is and reports what it holds", async () => {
      const { service, balanceSnapshotRepository, authzHttpService, logger } = setup({
        complete: { height: HEIGHT - 900, grantsCount: 41 }
      });

      const taken = await service.take(TAKEN_ON);

      expect(taken).toEqual({ network: NETWORK, takenOn: TAKEN_ON, height: HEIGHT - 900, grants: 41, isAlreadyComplete: true });
      expect(balanceSnapshotRepository.findByDay).toHaveBeenCalledWith({ network: NETWORK, takenOn: TAKEN_ON });
      expect(authzHttpService.getPaginatedDepositDeploymentGrants).not.toHaveBeenCalled();
      expect(balanceSnapshotRepository.addGrants).not.toHaveBeenCalled();
      expect(balanceSnapshotRepository.complete).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "BALANCE_SNAPSHOT_ALREADY_TAKEN", ...taken });
    });

    it("marks the snapshot failed with the reason and fails itself when the chain cannot be read", async () => {
      const { service, snapshot, balanceSnapshotRepository, authzHttpService, logger } = setup();
      const error = new Error("node has not reached this height");
      authzHttpService.getPaginatedDepositDeploymentGrants.mockRejectedValue(error);

      await expect(service.take(TAKEN_ON)).rejects.toBe(error);

      expect(balanceSnapshotRepository.fail).toHaveBeenCalledWith(snapshot.id, "node has not reached this height");
      expect(balanceSnapshotRepository.complete).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({ event: "BALANCE_SNAPSHOT_FAILED", network: NETWORK, takenOn: TAKEN_ON, height: HEIGHT, error });
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("records a failure that is not an error as text", async () => {
      const { service, snapshot, balanceSnapshotRepository, authzHttpService } = setup();
      authzHttpService.getPaginatedDepositDeploymentGrants.mockRejectedValue("timeout");

      await expect(service.take(TAKEN_ON)).rejects.toBe("timeout");

      expect(balanceSnapshotRepository.fail).toHaveBeenCalledWith(snapshot.id, "timeout");
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: BalanceSnapshotService.name });
  });

  function setup(
    input: {
      grants?: { active?: DepositDeploymentGrant["authorization"]["spend_limits"][]; draining?: DepositDeploymentGrant["authorization"]["spend_limits"][] };
      complete?: { height: number; grantsCount: number };
    } = {}
  ) {
    const active = createAkashAddress();
    const draining = createAkashAddress();
    const snapshot = mock<BalanceSnapshotOutput>({ id: crypto.randomUUID(), network: NETWORK, takenOn: TAKEN_ON, height: HEIGHT });
    const grantsOf = (granter: string, limits: DepositDeploymentGrant["authorization"]["spend_limits"][] = []) =>
      limits.map(
        (spend_limits): DepositDeploymentGrant => ({
          granter,
          grantee: createAkashAddress(),
          authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits },
          expiration: ""
        })
      );
    const grantsByGranter: Record<string, DepositDeploymentGrant[]> = {
      [active]: grantsOf(active, input.grants?.active),
      [draining]: grantsOf(draining, input.grants?.draining)
    };

    const balanceSnapshotRepository = mock<BalanceSnapshotRepository>();
    const fundingWalletRepository = mock<FundingWalletRepository>();
    const fundingWalletRegistry = mock<FundingWalletRegistryService>();
    const authzHttpService = mock<AuthzHttpService>();
    const blockHttpService = mock<BlockHttpService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    blockHttpService.getFreshCurrentHeight.mockResolvedValue(HEIGHT);
    balanceSnapshotRepository.startUnlessComplete.mockResolvedValue(input.complete ? undefined : snapshot);
    balanceSnapshotRepository.findByDay.mockResolvedValue(input.complete ? mock<BalanceSnapshotOutput>({ ...input.complete, status: "complete" }) : undefined);
    fundingWalletRegistry.getActiveAddress.mockResolvedValue(active);
    fundingWalletRepository.findDraining.mockResolvedValue(
      input.grants?.draining ? { id: crypto.randomUUID(), network: NETWORK, address: draining, status: "draining", drainingSince: new Date() } : undefined
    );
    authzHttpService.getPaginatedDepositDeploymentGrants.mockImplementation(async options => {
      const all = grantsByGranter[(options as { granter: string }).granter];

      return { grants: all.slice(options.offset, options.offset + options.limit), pagination: { next_key: null, total: all.length } };
    });

    const service = new BalanceSnapshotService(
      balanceSnapshotRepository,
      fundingWalletRepository,
      fundingWalletRegistry,
      authzHttpService,
      blockHttpService,
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return {
      service,
      active,
      draining,
      snapshot,
      grantees: { active: grantsByGranter[active].map(grant => grant.grantee), draining: grantsByGranter[draining].map(grant => grant.grantee) },
      balanceSnapshotRepository,
      fundingWalletRepository,
      authzHttpService,
      logger,
      createLogger
    };
  }
});
