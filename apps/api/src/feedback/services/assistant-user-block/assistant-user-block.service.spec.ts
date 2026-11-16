import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { envSchema } from "@src/feedback/config/env.config";
import type { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import type { AssistantUserBlockOutput, AssistantUserBlockRepository } from "@src/feedback/repositories/assistant-user-block/assistant-user-block.repository";
import type { AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";
import { NotifyAssistantUserBlock } from "@src/feedback/services/notify-assistant-user-block/notify-assistant-user-block.handler";
import { AssistantUserBlockService } from "./assistant-user-block.service";

const SENT_AT = new Date("2026-11-04T23:30:00.000Z");
const NEXT_MIDNIGHT = new Date("2026-11-05T00:00:00.000Z");

describe(AssistantUserBlockService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isBlocked", () => {
    it("asks the repository whether the user is blocked right now", async () => {
      vi.useFakeTimers({ now: SENT_AT });
      const { service, blockRepository } = setup();
      blockRepository.isBlocked.mockResolvedValue(true);

      expect(await service.isBlocked("user-1")).toBe(true);
      expect(blockRepository.isBlocked).toHaveBeenCalledWith("user-1", SENT_AT);
    });
  });

  describe("recordFlag", () => {
    it("records nothing when the message could not be labeled", async () => {
      const { service, traceRepository, usageRepository } = setup();

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: null });

      expect(traceRepository.flag).not.toHaveBeenCalled();
      expect(usageRepository.countFlaggedTurn).not.toHaveBeenCalled();
    });

    it("labels the trace of an on-topic turn without counting it", async () => {
      const { service, traceRepository, usageRepository } = setup();

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "on_topic" });

      expect(traceRepository.flag).toHaveBeenCalledWith("turn-1", "on_topic");
      expect(usageRepository.countFlaggedTurn).not.toHaveBeenCalled();
    });

    it("counts a flagged turn on the day it was sent without blocking below the limit", async () => {
      const { service, traceRepository, usageRepository, blockRepository } = setup();
      usageRepository.countFlaggedTurn.mockResolvedValue(2);

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "off_topic" });

      expect(traceRepository.flag).toHaveBeenCalledWith("turn-1", "off_topic");
      expect(usageRepository.countFlaggedTurn).toHaveBeenCalledWith("user-1", SENT_AT);
      expect(blockRepository.createAutomatic).not.toHaveBeenCalled();
    });

    it("blocks the user until the next UTC midnight and enqueues the Slack notice with the block once the limit is reached", async () => {
      vi.useFakeTimers({ now: SENT_AT });
      const { service, usageRepository, blockRepository, jobQueueService, txService, logger } = setup();
      usageRepository.countFlaggedTurn.mockResolvedValue(3);
      blockRepository.createAutomatic.mockResolvedValue(block());
      jobQueueService.enqueue.mockImplementation(async () => {
        expect(txService.transaction).toHaveBeenCalledTimes(1);
        return null;
      });

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "manipulation" });

      expect(blockRepository.createAutomatic).toHaveBeenCalledWith({ userId: "user-1", blockedUntil: NEXT_MIDNIGHT, flaggedTurnCount: 3 });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new NotifyAssistantUserBlock({ blockId: "block-1" }));
      expect(logger.info).toHaveBeenCalledWith({ event: "ASSISTANT_USER_BLOCKED", blockId: "block-1", source: "automatic", blockedUntil: NEXT_MIDNIGHT });
    });

    it("blocks until the midnight after the label lands when the turn was sent the day before", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-05T00:00:00.100Z") });
      const { service, usageRepository, blockRepository } = setup();
      usageRepository.countFlaggedTurn.mockResolvedValue(3);
      const sentAt = new Date("2026-11-04T23:59:59.900Z");

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt, flag: "off_topic" });

      expect(usageRepository.countFlaggedTurn).toHaveBeenCalledWith("user-1", sentAt);
      expect(blockRepository.createAutomatic).toHaveBeenCalledWith({
        userId: "user-1",
        blockedUntil: new Date("2026-11-06T00:00:00.000Z"),
        flaggedTurnCount: 3
      });
    });

    it("follows the configured limit", async () => {
      const { service, usageRepository, blockRepository } = setup({ limit: 5 });
      usageRepository.countFlaggedTurn.mockResolvedValueOnce(4).mockResolvedValueOnce(5);

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "off_topic" });
      expect(blockRepository.createAutomatic).not.toHaveBeenCalled();

      await service.recordFlag({ userId: "user-1", turnId: "turn-2", sentAt: SENT_AT, flag: "off_topic" });
      expect(blockRepository.createAutomatic).toHaveBeenCalledWith(expect.objectContaining({ flaggedTurnCount: 5 }));
    });

    it("posts nothing when the day's block already exists", async () => {
      const { service, usageRepository, blockRepository, jobQueueService, logger } = setup();
      usageRepository.countFlaggedTurn.mockResolvedValue(4);
      blockRepository.createAutomatic.mockResolvedValue(undefined);

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "off_topic" });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("still counts a flagged turn whose trace could not be written", async () => {
      const { service, traceRepository, usageRepository } = setup();

      await service.recordFlag({ userId: "user-1", turnId: undefined, sentAt: SENT_AT, flag: "off_topic" });

      expect(traceRepository.flag).not.toHaveBeenCalled();
      expect(usageRepository.countFlaggedTurn).toHaveBeenCalledWith("user-1", SENT_AT);
    });

    it("logs a failed trace label and still counts the turn", async () => {
      const { service, traceRepository, usageRepository, logger } = setup();
      const error = new Error("db down");
      traceRepository.flag.mockRejectedValue(error);

      await service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "off_topic" });

      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
      expect(usageRepository.countFlaggedTurn).toHaveBeenCalled();
    });

    it("logs instead of throwing when the turn cannot be counted or blocked", async () => {
      const { service, usageRepository, blockRepository, logger } = setup();
      const error = new Error("db down");
      usageRepository.countFlaggedTurn.mockResolvedValue(3);
      blockRepository.createAutomatic.mockRejectedValue(error);

      await expect(service.recordFlag({ userId: "user-1", turnId: "turn-1", sentAt: SENT_AT, flag: "off_topic" })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "ASSISTANT_FLAGGED_TURN_NOT_COUNTED", error });
    });
  });

  function block(): AssistantUserBlockOutput {
    return {
      id: "block-1",
      userId: "user-1",
      source: "automatic",
      blockedUntil: NEXT_MIDNIGHT,
      flaggedTurnCount: 3,
      reason: null,
      createdAt: SENT_AT,
      liftedAt: null,
      liftedBy: null,
      createdBy: null,
      madePermanentBy: null
    };
  }

  function setup(input: { limit?: number } = {}) {
    const blockRepository = mock<AssistantUserBlockRepository>();
    const usageRepository = mock<AssistantUserUsageRepository>();
    usageRepository.countFlaggedTurn.mockResolvedValue(1);
    const traceRepository = mock<AssistantTurnTraceRepository>();
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());
    const config = envSchema.parse({ ASSISTANT_DAILY_FLAGGED_TURN_LIMIT: input.limit });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new AssistantUserBlockService(
      blockRepository,
      usageRepository,
      traceRepository,
      jobQueueService,
      txService,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, blockRepository, usageRepository, traceRepository, jobQueueService, txService, logger };
  }
});
