import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import {
  buildSummaryMessages,
  type ConversationToClassify,
  FEEDBACK_SUMMARY_SCHEMA,
  feedbackItemOf,
  type ItemToClassify,
  type SubmissionToClassify
} from "@src/feedback/lib/feedback-classification-prompt/feedback-classification-prompt";
import { ITEM_QUESTIONS, itemStateOf, themeQuestionsFor, themeStateOf } from "@src/feedback/lib/feedback-jev-judgments/feedback-jev-judgments";
import type { FeedbackThemeOutput, FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import type { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import type { FeedbackThemeAssignmentService } from "@src/feedback/services/feedback-theme-assignment/feedback-theme-assignment.service";
import { MAX_THEME_CANDIDATES } from "@src/feedback/services/feedback-theme-assignment/feedback-theme-assignment.service";
import type { JevJudgments, JevRequest, TypeSafeClient } from "@src/feedback/services/typesafe-client/typesafe.client";
import { FeedbackJevClassifierService } from "./feedback-jev-classifier.service";

const SUMMARY = "Logs page stays empty";

const SUBMISSION: SubmissionToClassify = {
  kind: "general",
  outcome: null,
  rating: 2,
  category: "bug",
  message: "logs never load",
  context: { isTrialing: false }
};

const BUG_VALUES = {
  type_bug: 0.9,
  type_ux_friction: 0.2,
  type_feature_request: 0.1,
  type_support_question: 0.05,
  sentiment: 0,
  ended_stuck: 0.8,
  not_stuck: 0.1
};

describe(FeedbackJevClassifierService.name, () => {
  describe("isAvailable", () => {
    it("answers whether TypeSafe is configured", () => {
      const { service, typeSafeClient } = setup({});
      typeSafeClient.isAvailable.mockReturnValue(false);

      expect(service.isAvailable()).toBe(false);
    });
  });

  describe("classify", () => {
    it("asks Jev the item questions and AkashML for the summary, decides with the rules, and joins the matching theme", async () => {
      const candidates = [theme("theme-a"), theme("theme-b")];
      const { service, typeSafeClient, akashMlClient, feedbackThemeRepository, feedbackThemeAssignmentService, logger } = setup({
        values: BUG_VALUES,
        themeValues: { theme_0: 0.1, theme_1: 0.95 },
        candidates
      });
      const item: ItemToClassify = { submission: SUBMISSION };

      const result = await service.classify(item, { feedbackSubmissionId: "submission-1" });

      expect(typeSafeClient.judge).toHaveBeenCalledWith({ model: "jev-model", state: itemStateOf(feedbackItemOf(item)), questions: ITEM_QUESTIONS });
      expect(akashMlClient.completeJson).toHaveBeenCalledWith({
        model: "classifier-model",
        messages: buildSummaryMessages(item),
        schema: FEEDBACK_SUMMARY_SCHEMA,
        temperature: 0
      });
      expect(feedbackThemeRepository.findMatchCandidates).toHaveBeenCalledWith("bug", MAX_THEME_CANDIDATES);
      expect(typeSafeClient.judge).toHaveBeenCalledWith({
        model: "jev-model",
        state: themeStateOf({ type: "bug", summary: SUMMARY }),
        questions: themeQuestionsFor(candidates)
      });
      expect(feedbackThemeAssignmentService.nameNewTheme).not.toHaveBeenCalled();
      expect(result).toEqual({
        classification: { type: "bug", summary: SUMMARY, sentimentScore: -0.75, endedStuck: true },
        match: { item: { type: "bug", summary: SUMMARY }, theme: { themeId: "theme-b" } }
      });
      expect(logger.info).toHaveBeenCalledWith({
        event: "FEEDBACK_CLASSIFIED_WITH_JEV",
        feedbackSubmissionId: "submission-1",
        model: "jev-1.14.0",
        inputTokens: 300,
        type: {
          probabilities: { bug: 0.9, ux_friction: 0.2, feature_request: 0.1, support_question: 0.05 },
          cleared: ["bug"],
          decided: "bug",
          rule: "only_type_cleared"
        },
        sentiment: { level: 0, rating: 2, decided: -0.75, rule: "text_and_rating" },
        stuck: { probability: 0.8, notStuckProbability: 0.1, decided: true, rule: "judged_stuck" },
        theme: {
          compared: [
            { themeId: "theme-a", probability: 0.1 },
            { themeId: "theme-b", probability: 0.95 }
          ],
          possibleDuplicateThemeIds: [],
          rule: "only_theme_cleared",
          joined: "theme-b"
        }
      });
    });

    it("starts a theme named by AkashML when no theme clears the threshold", async () => {
      const { service, feedbackThemeAssignmentService, logger } = setup({
        values: BUG_VALUES,
        themeValues: { theme_0: 0.1 },
        candidates: [theme("theme-a")]
      });
      feedbackThemeAssignmentService.nameNewTheme.mockResolvedValue({ title: "Empty logs", summary: "The logs tab shows nothing" });

      const result = await service.classify({ submission: SUBMISSION }, {});

      expect(feedbackThemeAssignmentService.nameNewTheme).toHaveBeenCalledWith({ type: "bug", summary: SUMMARY });
      expect(result.match).toEqual({ item: { type: "bug", summary: SUMMARY }, theme: { title: "Empty logs", summary: "The logs tab shows nothing" } });
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ theme: expect.objectContaining({ rule: "no_theme_cleared", joined: null }) }));
    });

    it("joins the likeliest of two matching themes and traces them as a possible duplicate", async () => {
      const { service, logger } = setup({
        values: BUG_VALUES,
        themeValues: { theme_0: 0.9, theme_1: 0.97 },
        candidates: [theme("theme-a"), theme("theme-b")]
      });

      const result = await service.classify({ submission: SUBMISSION }, {});

      expect(result.match?.theme).toEqual({ themeId: "theme-b" });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: expect.objectContaining({ possibleDuplicateThemeIds: ["theme-b", "theme-a"], rule: "best_of_several_cleared" })
        })
      );
    });

    it("starts a theme from the item without asking Jev when its type has no open theme", async () => {
      const { service, typeSafeClient, feedbackThemeAssignmentService, logger } = setup({ values: BUG_VALUES, candidates: [] });

      const result = await service.classify({ submission: SUBMISSION }, {});

      expect(typeSafeClient.judge).toHaveBeenCalledTimes(1);
      expect(feedbackThemeAssignmentService.nameNewTheme).not.toHaveBeenCalled();
      expect(result.match?.theme).toEqual({ title: SUMMARY, summary: SUMMARY });
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 200, theme: { compared: [], rule: "no_open_theme" } }));
    });

    it("leaves an item no type clears without a theme", async () => {
      const { service, typeSafeClient, feedbackThemeRepository, logger } = setup({
        values: { ...BUG_VALUES, type_bug: 0.1, sentiment: 4, ended_stuck: 0.1, not_stuck: 0.9 }
      });

      const result = await service.classify({ submission: { ...SUBMISSION, rating: null } }, {});

      expect(result).toEqual({ classification: { type: null, summary: SUMMARY, sentimentScore: 1, endedStuck: false }, match: null });
      expect(feedbackThemeRepository.findMatchCandidates).not.toHaveBeenCalled();
      expect(typeSafeClient.judge).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 200,
          type: expect.objectContaining({ decided: null, rule: "no_type_cleared" }),
          sentiment: { level: 4, rating: null, decided: 1, rule: "text_only" },
          stuck: { probability: 0.1, notStuckProbability: 0.9, decided: false, rule: "judged_not_stuck" },
          theme: null
        })
      );
    });

    it("settles a conversation the user marked resolved from that fact, not the judgment", async () => {
      const { service, logger } = setup({ values: { ...BUG_VALUES, type_bug: 0 } });

      const result = await service.classify({ conversation: conversation({ resolvedByUser: true }) }, { conversationId: "conversation-1" });

      expect(result.classification).toEqual({ type: null, summary: SUMMARY, sentimentScore: -1, endedStuck: false });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-1",
          sentiment: expect.objectContaining({ rating: null, rule: "text_only" }),
          stuck: { probability: 0.8, notStuckProbability: 0.1, decided: false, rule: "resolved_by_user" }
        })
      );
    });

    it("judges how a conversation ended when no fact settles it", async () => {
      const { service, logger } = setup({ values: { ...BUG_VALUES, type_bug: 0, ended_stuck: 0.5, not_stuck: 0.5 } });

      const result = await service.classify({ conversation: conversation({ resolvedByUser: null }) }, {});

      expect(result.classification.endedStuck).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ stuck: { probability: 0.5, notStuckProbability: 0.5, decided: null, rule: "judgment_unsure" } })
      );
    });
  });

  function conversation(overrides: Partial<ConversationToClassify>): ConversationToClassify {
    return {
      status: "open",
      resolvedByUser: null,
      context: { isTrialing: false },
      messages: [
        { role: "user", content: "why no bids" },
        { role: "assistant", content: "the GPU is sold out" }
      ],
      ...overrides
    };
  }

  function theme(id: string): FeedbackThemeOutput {
    return mock<FeedbackThemeOutput>({ id, title: `Title of ${id}`, summary: null });
  }

  function setup(input: { values?: Record<string, number>; themeValues?: Record<string, number>; candidates?: FeedbackThemeOutput[] }) {
    const typeSafeClient = mock<TypeSafeClient>();
    typeSafeClient.isAvailable.mockReturnValue(true);
    typeSafeClient.judge.mockImplementation(
      async (request: JevRequest): Promise<JevJudgments> =>
        request.questions === ITEM_QUESTIONS
          ? { model: "jev-1.14.0", values: input.values ?? {}, inputTokens: 200 }
          : { model: "jev-1.14.0", values: input.themeValues ?? {}, inputTokens: 100 }
    );
    const akashMlClient = mock<AkashMlClient>();
    akashMlClient.completeJson.mockResolvedValue(SUMMARY);
    const feedbackThemeRepository = mock<FeedbackThemeRepository>();
    feedbackThemeRepository.findMatchCandidates.mockResolvedValue(input.candidates ?? []);
    const feedbackThemeAssignmentService = mock<FeedbackThemeAssignmentService>();
    const config = envSchema.parse({ FEEDBACK_CLASSIFIER_MODEL: "classifier-model", FEEDBACK_JEV_MODEL: "jev-model" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new FeedbackJevClassifierService(
      typeSafeClient,
      akashMlClient,
      feedbackThemeRepository,
      feedbackThemeAssignmentService,
      config,
      createLogger
    );

    return { service, typeSafeClient, akashMlClient, feedbackThemeRepository, feedbackThemeAssignmentService, logger };
  }
});
