import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { MoveUserToActiveFundingWallet } from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.job";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services";
import { FUNDING_WALLET_MOVE_PRIORITY, FundingWalletMoveQueueService } from "./funding-wallet-move-queue.service";

const NETWORK = "sandbox";
const USER_WALLET_ID = 42;
const KEY = "sandbox.42";

describe(FundingWalletMoveQueueService.name, () => {
  it("ranks a waiting user above a move that stopped halfway, that one above a running deployment, and that one above the rest", () => {
    expect(FUNDING_WALLET_MOVE_PRIORITY).toEqual({ rest: 0, hasOpenDeployment: 1, isUnfinished: 2, isWaiting: 3 });
  });

  describe("queue", () => {
    it("queues the move under the key of its network and user wallet, with its priority and start time", async () => {
      const { service, jobQueueService, txService } = setup();
      const startAfter = new Date("2026-11-27T12:04:00.000Z");

      await service.queue({ network: NETWORK, userWalletId: USER_WALLET_ID, priority: 1, startAfter });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new MoveUserToActiveFundingWallet({ userWalletId: USER_WALLET_ID }), {
        singletonKey: KEY,
        priority: 1,
        startAfter
      });
      expect(txService.outsideTransaction).not.toHaveBeenCalled();
    });
  });

  describe("queueAheadOfOthers", () => {
    it("calls off the move the user wallet has queued and queues it again at the top priority, outside the caller's transaction", async () => {
      const { service, jobQueueService, calls } = setup();

      await service.queueAheadOfOthers(NETWORK, USER_WALLET_ID);

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: "MoveUserToActiveFundingWallet", singletonKey: KEY });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new MoveUserToActiveFundingWallet({ userWalletId: USER_WALLET_ID }), {
        singletonKey: KEY,
        priority: 3
      });
      expect(calls).toEqual(["outsideTransaction:start", "cancelCreatedBy", "enqueue", "outsideTransaction:end"]);
    });

    it.each(["cancelCreatedBy", "enqueue"] as const)("logs and does not throw when %s fails, so the caller still answers with its refusal", async failing => {
      const { service, jobQueueService, logger } = setup();
      const error = new Error("queue unavailable");
      jobQueueService[failing].mockRejectedValue(error);

      await expect(service.queueAheadOfOthers(NETWORK, USER_WALLET_ID)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "FUNDING_WALLET_MOVE_QUEUE_AHEAD_FAILED", network: NETWORK, userWalletId: USER_WALLET_ID, error });
    });

    it("logs nothing when the move is queued", async () => {
      const { service, logger } = setup();

      await service.queueAheadOfOthers(NETWORK, USER_WALLET_ID);

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FundingWalletMoveQueueService.name });
  });

  function setup() {
    const calls: string[] = [];
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    jobQueueService.cancelCreatedBy.mockImplementation(async () => {
      calls.push("cancelCreatedBy");
    });
    jobQueueService.enqueue.mockImplementation(async () => {
      calls.push("enqueue");
      return "job-id";
    });
    txService.outsideTransaction.mockImplementation(async cb => {
      calls.push("outsideTransaction:start");
      const result = await cb();
      calls.push("outsideTransaction:end");
      return result;
    });

    const service = new FundingWalletMoveQueueService(jobQueueService, txService, createLogger);

    return { service, jobQueueService, txService, logger, createLogger, calls };
  }
});
