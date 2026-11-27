import type { AuthzHttpService, DepositDeploymentGrant, FeeAllowance } from "@akashnetwork/http-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { FundingWalletMoveRepository, FundingWalletMoveStatus } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import type { FundingWalletMoveService } from "@src/billing/services/funding-wallet-move/funding-wallet-move.service";
import type { FundingWalletMoveQueueService } from "@src/billing/services/funding-wallet-move-queue/funding-wallet-move-queue.service";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { FundingWalletDrainService } from "./funding-wallet-drain.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";
const DRAINING_SINCE = new Date("2026-11-27T12:00:00.000Z");
const MOVES_START_AT = new Date("2026-11-27T12:04:00.000Z");
const NOW = new Date("2026-11-27T13:00:00.000Z");

describe(FundingWalletDrainService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("queueMoves", () => {
    it("refuses when no funding wallet is draining", async () => {
      const { service, fundingWalletMoveQueue } = setup({ isDraining: false });

      await expect(service.queueMoves()).rejects.toMatchObject({ status: 409, message: "No funding wallet is draining", network: NETWORK });

      expect(fundingWalletMoveQueue.queue).not.toHaveBeenCalled();
    });

    it("queues one move for each user the chain shows a deposit grant or a fee allowance of, to start once late grants have landed", async () => {
      const { service, draining, jobQueueService, fundingWalletMoveQueue, authzHttpService, fundingWalletMoveService } = setup({
        users: [
          { id: 11, hasDepositGrant: true, hasFeeAllowance: true },
          { id: 12, hasDepositGrant: true },
          { id: 13, hasFeeAllowance: true }
        ]
      });

      await expect(service.queueMoves()).resolves.toEqual({ queued: 3, alreadyQueued: 0, withOpenDeployments: 0, unknownGrantees: 0 });

      expect(authzHttpService.getAllDepositDeploymentGrants).toHaveBeenCalledWith({ granter: draining.address, limit: 500 });
      expect(authzHttpService.getPaginatedFeeAllowancesForGranter).toHaveBeenCalledWith(draining.address, 500, 0);
      expect(fundingWalletMoveService.lateGrantsEndAt).toHaveBeenCalledWith(DRAINING_SINCE);
      expect(jobQueueService.findPendingSingletonKeys).toHaveBeenCalledWith("MoveUserToActiveFundingWallet");
      expect(fundingWalletMoveQueue.queue.mock.calls).toEqual(
        [11, 12, 13].map(userWalletId => [{ network: NETWORK, userWalletId, priority: 0, startAfter: MOVES_START_AT }])
      );
    });

    it("puts the users who have a deployment running ahead of the rest", async () => {
      const { service, fundingWalletMoveQueue } = setup({
        users: [
          { id: 11, hasDepositGrant: true },
          { id: 12, hasDepositGrant: true, hasOpenDeployment: true }
        ]
      });

      await expect(service.queueMoves()).resolves.toMatchObject({ queued: 2, withOpenDeployments: 1 });

      expect(fundingWalletMoveQueue.queue).toHaveBeenCalledWith(expect.objectContaining({ userWalletId: 11, priority: 0 }));
      expect(fundingWalletMoveQueue.queue).toHaveBeenCalledWith(expect.objectContaining({ userWalletId: 12, priority: 1 }));
    });

    it("queues nothing more for a user whose move is still queued or running, and does not count them as going first", async () => {
      const { service, fundingWalletMoveQueue } = setup({
        users: [
          { id: 11, hasDepositGrant: true, hasOpenDeployment: true, isAlreadyQueued: true },
          { id: 12, hasDepositGrant: true }
        ]
      });

      await expect(service.queueMoves()).resolves.toEqual({ queued: 1, alreadyQueued: 1, withOpenDeployments: 0, unknownGrantees: 0 });

      expect(fundingWalletMoveQueue.queue).toHaveBeenCalledTimes(1);
      expect(fundingWalletMoveQueue.queue).toHaveBeenCalledWith(expect.objectContaining({ userWalletId: 12 }));
    });

    it("counts the grantees that are no user wallet of this console and queues nothing for them", async () => {
      const { service, fundingWalletMoveQueue } = setup({
        users: [{ id: 11, hasDepositGrant: true }],
        strangers: { withDepositGrant: 2, withFeeAllowance: 1 }
      });

      await expect(service.queueMoves()).resolves.toEqual({ queued: 1, alreadyQueued: 0, withOpenDeployments: 0, unknownGrantees: 3 });

      expect(fundingWalletMoveQueue.queue).toHaveBeenCalledTimes(1);
    });

    it.each([
      [0, [0]],
      [500, [0]],
      [501, [0, 500]],
      [1001, [0, 500, 1000]]
    ])("reads %i fee allowances a page of 500 at a time", async (withFeeAllowance, offsets) => {
      const { service, draining, authzHttpService } = setup({ strangers: { withFeeAllowance } });

      await expect(service.queueMoves()).resolves.toMatchObject({ unknownGrantees: withFeeAllowance });

      expect(authzHttpService.getPaginatedFeeAllowancesForGranter.mock.calls).toEqual(offsets.map(offset => [draining.address, 500, offset]));
    });

    it("looks the grantees up 500 at a time", async () => {
      const { service, userWalletRepository, deploymentRepository } = setup({ strangers: { withDepositGrant: 501 } });

      await service.queueMoves();

      expect(userWalletRepository.findByAddresses.mock.calls.map(([addresses]) => addresses.length)).toEqual([500, 1]);
      expect(deploymentRepository.findOwnersWithOpenDeployments.mock.calls.map(([owners]) => owners.length)).toEqual([500, 1]);
    });

    it("logs what it queued", async () => {
      const { service, draining, logger } = setup({ users: [{ id: 11, hasDepositGrant: true, hasOpenDeployment: true }] });

      await service.queueMoves();

      expect(logger.info).toHaveBeenCalledWith({
        event: "FUNDING_WALLET_MOVES_QUEUED",
        address: draining.address,
        startAfter: MOVES_START_AT.toISOString(),
        queued: 1,
        alreadyQueued: 0,
        withOpenDeployments: 1,
        unknownGrantees: 0
      });
    });
  });

  describe("describe", () => {
    it("refuses when no funding wallet is draining", async () => {
      const { service } = setup({ isDraining: false });

      await expect(service.describe()).rejects.toMatchObject({ status: 409 });
    });

    it("reports what the chain still shows of the draining wallet and how the moves off it stand", async () => {
      const { service, draining, authzHttpService, fundingWalletMoveRepository, logger } = setup({
        left: { depositGrants: 40, feeAllowances: 65 },
        moves: { completed: 4100, failed: 3, revoking: 2 }
      });
      const status = {
        address: draining.address,
        lateGrantsEndAt: MOVES_START_AT.toISOString(),
        depositGrantsLeft: 40,
        feeAllowancesLeft: 65,
        moves: { completed: 4100, failed: 3, revoking: 2 }
      };

      await expect(service.describe()).resolves.toEqual(status);

      expect(authzHttpService.getPaginatedDepositDeploymentGrants).toHaveBeenCalledWith({ granter: draining.address, limit: 1, offset: 0 });
      expect(authzHttpService.getPaginatedFeeAllowancesForGranter).toHaveBeenCalledWith(draining.address, 1, 0);
      expect(fundingWalletMoveRepository.countByStatus).toHaveBeenCalledWith(draining.id);
      expect(logger.info).toHaveBeenCalledWith({ event: "FUNDING_WALLET_DRAIN_STATUS", ...status });
    });
  });

  describe("retire", () => {
    it("retires the draining wallet once the chain shows nothing of it, whatever moves finished or need a review", async () => {
      const { service, draining, fundingWalletRepository, logger } = setup({ moves: { completed: 4100, failed: 3 } });
      const status = {
        address: draining.address,
        lateGrantsEndAt: MOVES_START_AT.toISOString(),
        depositGrantsLeft: 0,
        feeAllowancesLeft: 0,
        moves: { completed: 4100, failed: 3 }
      };

      await expect(service.retire(draining.address)).resolves.toEqual(status);

      expect(fundingWalletRepository.updateStatus).toHaveBeenCalledWith(draining.id, "retired");
      expect(logger.info).toHaveBeenCalledWith({ event: "FUNDING_WALLET_RETIRED", ...status });
    });

    it("refuses while a grant signed before the promotion can still land, even though the chain shows nothing yet", async () => {
      const lateGrantsEndAt = new Date(NOW.getTime() + 1);
      const { service, draining, fundingWalletRepository, logger } = setup({ lateGrantsEndAt });

      await expect(service.retire(draining.address)).rejects.toMatchObject({
        status: 503,
        message: "A grant signed before the promotion can still land on the draining funding wallet",
        retryAt: lateGrantsEndAt.toISOString()
      });

      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("retires from the moment such a grant can no longer land", async () => {
      const { service, draining, fundingWalletRepository } = setup({ lateGrantsEndAt: NOW });

      await service.retire(draining.address);

      expect(fundingWalletRepository.updateStatus).toHaveBeenCalledWith(draining.id, "retired");
    });

    it("refuses a wallet that is not the one draining", async () => {
      const { service, draining, fundingWalletRepository, authzHttpService } = setup();
      const other = createAkashAddress();

      await expect(service.retire(other)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${other} is not the one draining, ${draining.address} is`,
        network: NETWORK
      });

      expect(authzHttpService.getPaginatedDepositDeploymentGrants).not.toHaveBeenCalled();
      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("refuses when no funding wallet is draining", async () => {
      const { service, fundingWalletRepository } = setup({ isDraining: false });

      await expect(service.retire(createAkashAddress())).rejects.toMatchObject({ status: 409, message: "No funding wallet is draining" });

      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
    });

    it.each<[string, { left?: { depositGrants?: number; feeAllowances?: number }; moves?: Partial<Record<FundingWalletMoveStatus, number>> }, number]>([
      ["a deposit grant is left on chain", { left: { depositGrants: 1 } }, 0],
      ["a fee allowance is left on chain", { left: { feeAllowances: 1 } }, 0],
      ["a move has not revoked yet", { moves: { revoking: 1 } }, 1],
      ["a move has not credited yet", { moves: { revoked: 1 } }, 1],
      ["a move is crediting", { moves: { crediting: 1 } }, 1],
      ["several moves are unfinished", { moves: { revoking: 2, revoked: 3, crediting: 4, completed: 9 } }, 9]
    ])("refuses while %s", async (_case, state, unfinishedMoves) => {
      const { service, draining, fundingWalletRepository, logger } = setup(state);

      await expect(service.retire(draining.address)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${draining.address} still backs users`,
        depositGrantsLeft: state.left?.depositGrants ?? 0,
        feeAllowancesLeft: state.left?.feeAllowances ?? 0,
        unfinishedMoves
      });

      expect(fundingWalletRepository.updateStatus).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FundingWalletDrainService.name });
  });

  function setup(
    input: {
      isDraining?: boolean;
      users?: { id: number; hasDepositGrant?: boolean; hasFeeAllowance?: boolean; hasOpenDeployment?: boolean; isAlreadyQueued?: boolean }[];
      strangers?: { withDepositGrant?: number; withFeeAllowance?: number };
      left?: { depositGrants?: number; feeAllowances?: number };
      moves?: Partial<Record<FundingWalletMoveStatus, number>>;
      lateGrantsEndAt?: Date;
    } = {}
  ) {
    vi.useFakeTimers({ now: NOW });

    const draining = { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "draining" as const, drainingSince: DRAINING_SINCE };
    const users = (input.users ?? []).map(user => ({ ...user, address: createAkashAddress() }));
    const addressesOf = (count = 0) => Array.from({ length: count }, () => createAkashAddress());
    const depositGrantees = [...users.filter(user => user.hasDepositGrant).map(user => user.address), ...addressesOf(input.strangers?.withDepositGrant)];
    const feeGrantees = [...users.filter(user => user.hasFeeAllowance).map(user => user.address), ...addressesOf(input.strangers?.withFeeAllowance)];
    const depositGrants = depositGrantees.map(
      (grantee): DepositDeploymentGrant => ({
        granter: draining.address,
        grantee,
        authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: [] },
        expiration: ""
      })
    );
    const feeAllowances = feeGrantees.map(
      (grantee): FeeAllowance => ({
        granter: draining.address,
        grantee,
        allowance: { "@type": "/cosmos.feegrant.v1beta1.BasicAllowance", spend_limit: [], expiration: "" }
      })
    );

    const fundingWalletRepository = mock<FundingWalletRepository>();
    const fundingWalletMoveRepository = mock<FundingWalletMoveRepository>();
    const fundingWalletMoveService = mock<FundingWalletMoveService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentRepository = mock<DeploymentRepository>();
    const authzHttpService = mock<AuthzHttpService>();
    const jobQueueService = mock<JobQueueService>();
    const fundingWalletMoveQueue = mock<FundingWalletMoveQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    fundingWalletRepository.findDraining.mockResolvedValue(input.isDraining === false ? undefined : draining);
    fundingWalletMoveRepository.countByStatus.mockResolvedValue(input.moves ?? {});
    fundingWalletMoveService.lateGrantsEndAt.mockReturnValue(input.lateGrantsEndAt ?? MOVES_START_AT);
    userWalletRepository.findByAddresses.mockImplementation(async addresses =>
      users.filter(user => addresses.includes(user.address)).map(user => mock<UserWalletOutput>({ id: user.id, address: user.address }))
    );
    deploymentRepository.findOwnersWithOpenDeployments.mockImplementation(async owners =>
      users.filter(user => user.hasOpenDeployment && owners.includes(user.address)).map(user => user.address)
    );
    authzHttpService.getAllDepositDeploymentGrants.mockResolvedValue(depositGrants);
    authzHttpService.getPaginatedDepositDeploymentGrants.mockResolvedValue({
      grants: [],
      pagination: { next_key: null, total: input.left?.depositGrants ?? 0 }
    });
    authzHttpService.getPaginatedFeeAllowancesForGranter.mockImplementation(async (_granter, limit, offset) => ({
      allowances: feeAllowances.slice(offset, offset + limit),
      pagination: { next_key: null, total: input.left?.feeAllowances ?? feeAllowances.length }
    }));
    jobQueueService.findPendingSingletonKeys.mockResolvedValue(new Set(users.filter(user => user.isAlreadyQueued).map(user => `${NETWORK}.${user.id}`)));

    const service = new FundingWalletDrainService(
      fundingWalletRepository,
      fundingWalletMoveRepository,
      fundingWalletMoveService,
      userWalletRepository,
      deploymentRepository,
      authzHttpService,
      jobQueueService,
      fundingWalletMoveQueue,
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return {
      service,
      draining,
      fundingWalletRepository,
      fundingWalletMoveRepository,
      fundingWalletMoveService,
      userWalletRepository,
      deploymentRepository,
      authzHttpService,
      jobQueueService,
      fundingWalletMoveQueue,
      logger,
      createLogger
    };
  }
});
