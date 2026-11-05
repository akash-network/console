import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import type { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import { ClassifyConversation, classifyConversationOptionsFor } from "@src/feedback/services/classify-conversation/classify-conversation.handler";
import { ClassifyFeedback, classifyFeedbackOptionsFor } from "@src/feedback/services/classify-feedback/classify-feedback.handler";
import type { FeedbackThemeScoreService } from "@src/feedback/services/feedback-theme-score/feedback-theme-score.service";
import { BACKFILL_BATCH_SIZE, SweepFeedback, SweepFeedbackHandler, sweepFeedbackOptionsFor } from "./sweep-feedback.handler";

const NOW = new Date("2026-11-04T12:00:00.000Z");

describe(SweepFeedbackHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts the sweep job with one waiting at a time and needs no permission", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(SweepFeedback);
    expect(handler.policy).toBe("short");
    expect(handler.requiresPermission()).toEqual([]);
  });

  it("queues the next sweep an hour out under one key", () => {
    expect(sweepFeedbackOptionsFor(NOW)).toEqual({ singletonKey: "sweepFeedback", startAfter: "2026-11-04T13:00:00.000Z" });
    expect(new SweepFeedback()).toMatchObject({ name: "SweepFeedback", version: 1, data: {} });
  });

  it("queues the next sweep, the unclassified items and rescores every theme", async () => {
    vi.useFakeTimers({ now: NOW });
    const { handler, jobQueueService, feedbackSubmissionRepository, assistantConversationRepository, feedbackThemeScoreService, logger } = setup();
    feedbackSubmissionRepository.findUnclassifiedIds.mockResolvedValue(["s1", "s2"]);
    assistantConversationRepository.findUnclassifiedIds.mockResolvedValue(["c1"]);
    feedbackThemeScoreService.rescoreAll.mockResolvedValue(7);

    await handler.handle();

    expect(jobQueueService.enqueue.mock.calls).toEqual([
      [new SweepFeedback(), sweepFeedbackOptionsFor(NOW)],
      [new ClassifyFeedback({ feedbackSubmissionId: "s1" }), classifyFeedbackOptionsFor("s1")],
      [new ClassifyFeedback({ feedbackSubmissionId: "s2" }), classifyFeedbackOptionsFor("s2")],
      [new ClassifyConversation({ conversationId: "c1" }), classifyConversationOptionsFor("c1")]
    ]);
    expect(feedbackSubmissionRepository.findUnclassifiedIds).toHaveBeenCalledWith(BACKFILL_BATCH_SIZE);
    expect(assistantConversationRepository.findUnclassifiedIds).toHaveBeenCalledWith(new Date("2026-11-04T11:30:00.000Z"), BACKFILL_BATCH_SIZE);
    expect(feedbackThemeScoreService.rescoreAll).toHaveBeenCalledWith(NOW);
    expect(logger.info).toHaveBeenCalledWith({ event: "FEEDBACK_SWEPT", backfilled: { submissions: 2, conversations: 1 }, rescored: 7 });
  });

  it("only rescores while the model is unavailable", async () => {
    const { handler, jobQueueService, feedbackSubmissionRepository, feedbackThemeScoreService, logger } = setup({ isAvailable: false });
    feedbackThemeScoreService.rescoreAll.mockResolvedValue(2);

    await handler.handle();

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(SweepFeedback), expect.anything());
    expect(feedbackSubmissionRepository.findUnclassifiedIds).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "FEEDBACK_SWEPT", backfilled: null, rescored: 2 });
  });

  function setup(input: { isAvailable?: boolean } = {}) {
    const jobQueueService = mock<JobQueueService>();
    const feedbackSubmissionRepository = mock<FeedbackSubmissionRepository>();
    feedbackSubmissionRepository.findUnclassifiedIds.mockResolvedValue([]);
    const assistantConversationRepository = mock<AssistantConversationRepository>();
    assistantConversationRepository.findUnclassifiedIds.mockResolvedValue([]);
    const akashMlClient = mock<AkashMlClient>();
    akashMlClient.isAvailable.mockReturnValue(input.isAvailable ?? true);
    const feedbackThemeScoreService = mock<FeedbackThemeScoreService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new SweepFeedbackHandler(
      jobQueueService,
      feedbackSubmissionRepository,
      assistantConversationRepository,
      akashMlClient,
      feedbackThemeScoreService,
      createLogger
    );

    return { handler, jobQueueService, feedbackSubmissionRepository, assistantConversationRepository, feedbackThemeScoreService, logger };
  }
});
