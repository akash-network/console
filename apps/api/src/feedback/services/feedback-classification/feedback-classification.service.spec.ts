import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import { envSchema } from "@src/feedback/config/env.config";
import {
  buildConversationClassificationMessages,
  buildSubmissionClassificationMessages,
  FEEDBACK_CLASSIFICATION_SCHEMA,
  type FeedbackClassification
} from "@src/feedback/lib/feedback-classification-prompt/feedback-classification-prompt";
import type { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { AssistantMessageOutput, AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";
import type { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import type { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { type AkashMlClient, AkashMlOutputError } from "@src/feedback/services/akashml-client/akashml.client";
import type { FeedbackThemeAssignmentService } from "@src/feedback/services/feedback-theme-assignment/feedback-theme-assignment.service";
import type { FeedbackThemeScoreService } from "@src/feedback/services/feedback-theme-score/feedback-theme-score.service";
import { FeedbackClassificationService, MAX_CLASSIFICATION_ATTEMPTS } from "./feedback-classification.service";

import { createAssistantConversation } from "@test/seeders/assistant-conversation.seeder";
import { createFeedbackSubmission } from "@test/seeders/feedback-submission.seeder";

const CLASSIFICATION: FeedbackClassification = { type: "bug", summary: "Logs page stays empty", sentimentScore: -0.5, endedStuck: true };

describe(FeedbackClassificationService.name, () => {
  describe("classifySubmission", () => {
    it("classifies a submission with the model, files it under its theme, and recounts and rescores that theme", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load", rating: 2 });
      const { service, akashMlClient, feedbackSubmissionRepository, feedbackThemeAssignmentService, feedbackThemeRepository, feedbackThemeScoreService } =
        setup({ submission });
      feedbackThemeAssignmentService.findMatch.mockResolvedValue({ themeId: "theme-1" });
      feedbackThemeAssignmentService.themeIdFor.mockResolvedValue("theme-2");

      await service.classifySubmission(submission.id);

      expect(akashMlClient.completeJson).toHaveBeenCalledWith({
        model: "classifier-model",
        messages: buildSubmissionClassificationMessages(submission),
        schema: FEEDBACK_CLASSIFICATION_SCHEMA,
        temperature: 0
      });
      expect(feedbackThemeAssignmentService.findMatch).toHaveBeenCalledWith({ type: "bug", summary: "Logs page stays empty" });
      expect(feedbackThemeAssignmentService.themeIdFor).toHaveBeenCalledWith({ themeId: "theme-1" }, { type: "bug", summary: "Logs page stays empty" });
      expect(feedbackSubmissionRepository.updateById).toHaveBeenCalledWith(submission.id, {
        classificationType: "bug",
        classificationSummary: "Logs page stays empty",
        sentimentScore: -0.5,
        endedStuck: true,
        classifiedAt: expect.any(Date),
        themeId: "theme-2"
      });
      expect(feedbackThemeRepository.refreshCounts).toHaveBeenCalledWith(["theme-2"]);
      expect(feedbackThemeScoreService.rescore).toHaveBeenCalledWith(["theme-2"]);
    });

    it("writes the classification, theme and counts in one transaction after the model calls", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, txService, akashMlClient, feedbackThemeAssignmentService, feedbackSubmissionRepository, feedbackThemeScoreService } = setup({
        submission
      });
      feedbackThemeAssignmentService.findMatch.mockResolvedValue({ title: "Logs", summary: "Logs" });
      feedbackThemeAssignmentService.themeIdFor.mockResolvedValue("theme-1");
      txService.transaction.mockImplementation(async cb => {
        expect(akashMlClient.completeJson).toHaveBeenCalled();
        expect(feedbackThemeAssignmentService.findMatch).toHaveBeenCalled();
        expect(feedbackSubmissionRepository.updateById).not.toHaveBeenCalled();
        const result = await cb();
        expect(feedbackThemeScoreService.rescore).toHaveBeenCalled();
        return result;
      });

      await service.classifySubmission(submission.id);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });

    it.each([
      { name: "a non-actionable item", classification: { ...CLASSIFICATION, type: null } },
      { name: "an item without a summary", classification: { ...CLASSIFICATION, summary: null } }
    ])("stores $name without a theme", async ({ classification }) => {
      const submission = createFeedbackSubmission({ message: "great product" });
      const { service, akashMlClient, feedbackSubmissionRepository, feedbackThemeAssignmentService, feedbackThemeRepository, feedbackThemeScoreService } =
        setup({ submission });
      akashMlClient.completeJson.mockResolvedValue(classification);

      await service.classifySubmission(submission.id);

      expect(feedbackThemeAssignmentService.findMatch).not.toHaveBeenCalled();
      expect(feedbackThemeAssignmentService.themeIdFor).not.toHaveBeenCalled();
      expect(feedbackSubmissionRepository.updateById).toHaveBeenCalledWith(submission.id, expect.objectContaining({ themeId: null }));
      expect(feedbackThemeRepository.refreshCounts).not.toHaveBeenCalled();
      expect(feedbackThemeScoreService.rescore).not.toHaveBeenCalled();
    });

    it("classifies a bare rating from the rating alone, even without a model", async () => {
      const submission = createFeedbackSubmission({ message: null, rating: 5, context: { isTrialing: false } });
      const { service, akashMlClient, feedbackSubmissionRepository } = setup({ submission, isAvailable: false });

      await service.classifySubmission(submission.id);

      expect(akashMlClient.completeJson).not.toHaveBeenCalled();
      expect(feedbackSubmissionRepository.updateById).toHaveBeenCalledWith(submission.id, {
        classificationType: null,
        classificationSummary: null,
        sentimentScore: 1,
        endedStuck: null,
        classifiedAt: expect.any(Date),
        themeId: null
      });
    });

    it("classifies a failure reason left without a message", async () => {
      const submission = createFeedbackSubmission({ message: null, context: { isTrialing: true, failureReason: "no bids" } });
      const { service, akashMlClient } = setup({ submission });

      await service.classifySubmission(submission.id);

      expect(akashMlClient.completeJson).toHaveBeenCalled();
    });

    it("leaves a submission with text unclassified and says so when the model is unavailable", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, akashMlClient, feedbackSubmissionRepository, logger } = setup({ submission, isAvailable: false });

      await service.classifySubmission(submission.id);

      expect(akashMlClient.completeJson).not.toHaveBeenCalled();
      expect(feedbackSubmissionRepository.updateById).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "FEEDBACK_CLASSIFICATION_DEFERRED", reason: "model_unavailable", feedbackSubmissionId: submission.id });
    });

    it.each([
      { name: "a deleted submission", submission: undefined },
      { name: "a dismissed prompt", submission: createFeedbackSubmission({ dismissed: true, message: "x" }) },
      { name: "a classified submission", submission: createFeedbackSubmission({ classifiedAt: new Date(), message: "x" }) },
      { name: "a submission given up on", submission: createFeedbackSubmission({ classificationFailedAt: new Date(), message: "x" }) }
    ])("skips $name", async ({ submission }) => {
      const { service, akashMlClient, feedbackSubmissionRepository } = setup({ submission });

      await service.classifySubmission(submission?.id ?? "missing");

      expect(akashMlClient.completeJson).not.toHaveBeenCalled();
      expect(feedbackSubmissionRepository.updateById).not.toHaveBeenCalled();
    });

    it("stores nothing when the model fails, so the job retries", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, akashMlClient, feedbackSubmissionRepository } = setup({ submission });
      akashMlClient.completeJson.mockRejectedValue(new Error("AkashML answered 503"));

      await expect(service.classifySubmission(submission.id)).rejects.toThrow("AkashML answered 503");
      expect(feedbackSubmissionRepository.updateById).not.toHaveBeenCalled();
      expect(feedbackSubmissionRepository.recordFailedClassification).not.toHaveBeenCalled();
    });

    it("counts an unusable answer against the submission and fails so the job retries", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, akashMlClient, feedbackSubmissionRepository, logger } = setup({ submission });
      const unusable = new AkashMlOutputError("AkashML answered with malformed JSON");
      akashMlClient.completeJson.mockRejectedValue(unusable);
      feedbackSubmissionRepository.recordFailedClassification.mockResolvedValue({ attempts: 2, abandoned: false });

      await expect(service.classifySubmission(submission.id)).rejects.toBe(unusable);
      expect(feedbackSubmissionRepository.recordFailedClassification).toHaveBeenCalledWith(submission.id, MAX_CLASSIFICATION_ATTEMPTS);
      expect(feedbackSubmissionRepository.updateById).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("counts an unusable theme match against the submission", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, feedbackThemeAssignmentService, feedbackSubmissionRepository } = setup({ submission });
      feedbackThemeAssignmentService.findMatch.mockRejectedValue(new AkashMlOutputError("AkashML answered outside the schema: themeKey"));
      feedbackSubmissionRepository.recordFailedClassification.mockResolvedValue({ attempts: 1, abandoned: false });

      await expect(service.classifySubmission(submission.id)).rejects.toThrow("outside the schema");
      expect(feedbackSubmissionRepository.recordFailedClassification).toHaveBeenCalled();
    });

    it("gives up on a submission that used its last attempt and says so", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, akashMlClient, feedbackSubmissionRepository, logger } = setup({ submission });
      akashMlClient.completeJson.mockRejectedValue(new AkashMlOutputError("AkashML answered with malformed JSON"));
      feedbackSubmissionRepository.recordFailedClassification.mockResolvedValue({ attempts: MAX_CLASSIFICATION_ATTEMPTS, abandoned: true });

      await service.classifySubmission(submission.id);

      expect(feedbackSubmissionRepository.updateById).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({
        event: "FEEDBACK_CLASSIFICATION_ABANDONED",
        feedbackSubmissionId: submission.id,
        attempts: MAX_CLASSIFICATION_ATTEMPTS,
        reason: "AkashML answered with malformed JSON"
      });
    });

    it("stops quietly when the submission was deleted while the model answered", async () => {
      const submission = createFeedbackSubmission({ message: "logs never load" });
      const { service, akashMlClient, feedbackSubmissionRepository, logger } = setup({ submission });
      akashMlClient.completeJson.mockRejectedValue(new AkashMlOutputError("AkashML answered with malformed JSON"));
      feedbackSubmissionRepository.recordFailedClassification.mockResolvedValue(undefined);

      await service.classifySubmission(submission.id);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("classifyConversation", () => {
    it("classifies a conversation from its messages and files it under its theme", async () => {
      const conversation = createAssistantConversation({ status: "unresolved" });
      const messages = [message("user", "why no bids"), message("assistant", "check the price")];
      const { service, akashMlClient, assistantConversationRepository, assistantMessageRepository, feedbackThemeAssignmentService } = setup({
        conversation,
        messages
      });
      feedbackThemeAssignmentService.findMatch.mockResolvedValue({ themeId: "theme-1" });
      feedbackThemeAssignmentService.themeIdFor.mockResolvedValue("theme-1");

      await service.classifyConversation(conversation.id);

      expect(assistantMessageRepository.findAllOf).toHaveBeenCalledWith(conversation.id);
      expect(akashMlClient.completeJson).toHaveBeenCalledWith({
        model: "classifier-model",
        messages: buildConversationClassificationMessages({ ...conversation, messages }),
        schema: FEEDBACK_CLASSIFICATION_SCHEMA,
        temperature: 0
      });
      expect(assistantConversationRepository.updateById).toHaveBeenCalledWith(conversation.id, {
        classificationType: "bug",
        classificationSummary: "Logs page stays empty",
        sentimentScore: -0.5,
        endedStuck: true,
        classifiedAt: expect.any(Date),
        themeId: "theme-1"
      });
    });

    it("settles a conversation where the user never wrote without asking the model", async () => {
      const conversation = createAssistantConversation();
      const { service, akashMlClient, assistantConversationRepository } = setup({ conversation, messages: [message("assistant", "hi")] });

      await service.classifyConversation(conversation.id);

      expect(akashMlClient.completeJson).not.toHaveBeenCalled();
      expect(assistantConversationRepository.updateById).toHaveBeenCalledWith(conversation.id, {
        classificationType: null,
        classificationSummary: null,
        sentimentScore: 0,
        endedStuck: null,
        classifiedAt: expect.any(Date),
        themeId: null
      });
    });

    it("counts an unusable answer against the conversation and gives up after the last attempt", async () => {
      const conversation = createAssistantConversation();
      const { service, akashMlClient, assistantConversationRepository, logger } = setup({ conversation, messages: [message("user", "help")] });
      akashMlClient.completeJson.mockRejectedValue(new AkashMlOutputError("AkashML answered without a JSON object"));
      assistantConversationRepository.recordFailedClassification.mockResolvedValue({ attempts: MAX_CLASSIFICATION_ATTEMPTS, abandoned: true });

      await service.classifyConversation(conversation.id);

      expect(assistantConversationRepository.recordFailedClassification).toHaveBeenCalledWith(conversation.id, MAX_CLASSIFICATION_ATTEMPTS);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "FEEDBACK_CLASSIFICATION_ABANDONED",
        conversationId: conversation.id,
        attempts: MAX_CLASSIFICATION_ATTEMPTS,
        reason: "AkashML answered without a JSON object"
      });
    });

    it("defers a conversation while the model is unavailable", async () => {
      const conversation = createAssistantConversation();
      const { service, assistantMessageRepository, logger } = setup({ conversation, isAvailable: false });

      await service.classifyConversation(conversation.id);

      expect(assistantMessageRepository.findAllOf).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "FEEDBACK_CLASSIFICATION_DEFERRED", reason: "model_unavailable", conversationId: conversation.id });
    });

    it.each([
      { name: "a deleted conversation", conversation: undefined },
      { name: "a classified conversation", conversation: createAssistantConversation({ classifiedAt: new Date() }) },
      { name: "a conversation given up on", conversation: createAssistantConversation({ classificationFailedAt: new Date() }) }
    ])("skips $name", async ({ conversation }) => {
      const { service, assistantMessageRepository, akashMlClient } = setup({ conversation });

      await service.classifyConversation(conversation?.id ?? "missing");

      expect(assistantMessageRepository.findAllOf).not.toHaveBeenCalled();
      expect(akashMlClient.completeJson).not.toHaveBeenCalled();
    });

    function message(role: AssistantMessageOutput["role"], content: string): AssistantMessageOutput {
      return { id: crypto.randomUUID(), conversationId: "c", role, content, toolName: null, toolPayload: null, createdAt: new Date() };
    }
  });

  function setup(input: {
    submission?: ReturnType<typeof createFeedbackSubmission>;
    conversation?: ReturnType<typeof createAssistantConversation>;
    messages?: AssistantMessageOutput[];
    isAvailable?: boolean;
  }) {
    const feedbackSubmissionRepository = mock<FeedbackSubmissionRepository>();
    feedbackSubmissionRepository.findById.mockResolvedValue(input.submission);
    const assistantConversationRepository = mock<AssistantConversationRepository>();
    assistantConversationRepository.findById.mockResolvedValue(input.conversation);
    const assistantMessageRepository = mock<AssistantMessageRepository>();
    assistantMessageRepository.findAllOf.mockResolvedValue(input.messages ?? []);
    const feedbackThemeRepository = mock<FeedbackThemeRepository>();
    const feedbackThemeAssignmentService = mock<FeedbackThemeAssignmentService>();
    const feedbackThemeScoreService = mock<FeedbackThemeScoreService>();
    const akashMlClient = mock<AkashMlClient>();
    akashMlClient.isAvailable.mockReturnValue(input.isAvailable ?? true);
    akashMlClient.completeJson.mockResolvedValue(CLASSIFICATION);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const config = envSchema.parse({ FEEDBACK_CLASSIFIER_MODEL: "classifier-model" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new FeedbackClassificationService(
      feedbackSubmissionRepository,
      assistantConversationRepository,
      assistantMessageRepository,
      feedbackThemeRepository,
      feedbackThemeAssignmentService,
      feedbackThemeScoreService,
      akashMlClient,
      txService,
      config,
      createLogger
    );

    return {
      service,
      feedbackSubmissionRepository,
      assistantConversationRepository,
      assistantMessageRepository,
      feedbackThemeRepository,
      feedbackThemeAssignmentService,
      feedbackThemeScoreService,
      akashMlClient,
      txService,
      logger
    };
  }
});
