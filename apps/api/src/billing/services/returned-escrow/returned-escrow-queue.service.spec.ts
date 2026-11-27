import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CompletedFundingWalletMove, FundingWalletMoveRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { CreditReturnedEscrow } from "./credit-returned-escrow.job";
import { ReturnedEscrowQueueService } from "./returned-escrow-queue.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const NETWORK = "sandbox";
const NOW = new Date("2026-11-27T12:00:00.000Z");

describe(ReturnedEscrowQueueService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues the credit of a close for a user wallet that was moved off a funding wallet, to start a minute later", async () => {
    const { service, fundingWalletMoveRepository, jobQueueService } = setup({ hasMoved: true });

    await service.queueAfterClose(7, "CLOSE_HASH");

    expect(fundingWalletMoveRepository.findCompletedOf).toHaveBeenCalledWith(7, NETWORK);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new CreditReturnedEscrow({ userWalletId: 7, closeTxHash: "CLOSE_HASH" }), {
      startAfter: new Date("2026-11-27T12:01:00.000Z")
    });
  });

  it("queues nothing for a user wallet that was never moved", async () => {
    const { service, jobQueueService } = setup({ hasMoved: false });

    await service.queueAfterClose(7, "CLOSE_HASH");

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it.each(["findCompletedOf", "enqueue"] as const)("logs and does not throw when %s fails, so the close it follows still succeeds", async failing => {
    const { service, fundingWalletMoveRepository, jobQueueService, logger } = setup({ hasMoved: true });
    const error = new Error("connection reset");
    if (failing === "findCompletedOf") fundingWalletMoveRepository.findCompletedOf.mockRejectedValue(error);
    else jobQueueService.enqueue.mockRejectedValue(error);

    await expect(service.queueAfterClose(7, "CLOSE_HASH")).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith({ event: "RETURNED_ESCROW_CREDIT_QUEUE_FAILED", userWalletId: 7, closeTxHash: "CLOSE_HASH", error });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup({ hasMoved: false });

    expect(createLogger).toHaveBeenCalledWith({ context: ReturnedEscrowQueueService.name });
  });

  function setup(input: { hasMoved: boolean }) {
    vi.useFakeTimers({ now: NOW });

    const fundingWalletMoveRepository = mock<FundingWalletMoveRepository>();
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    fundingWalletMoveRepository.findCompletedOf.mockResolvedValue(input.hasMoved ? [mock<CompletedFundingWalletMove>()] : []);

    const service = new ReturnedEscrowQueueService(
      fundingWalletMoveRepository,
      jobQueueService,
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return { service, fundingWalletMoveRepository, jobQueueService, logger, createLogger };
  }
});
