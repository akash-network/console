import { addHours } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { FEEDBACK_CONFIG } from "@src/feedback/providers/config.provider";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient, type ChatCompletion } from "@src/feedback/services/akashml-client/akashml.client";
import { MAX_CLASSIFICATION_ATTEMPTS } from "@src/feedback/services/feedback-classification/feedback-classification.service";
import { type JevJudgments, TypeSafeClient } from "@src/feedback/services/typesafe-client/typesafe.client";
import { ClassifyFeedback, ClassifyFeedbackHandler, classifyFeedbackOptionsFor } from "./classify-feedback.handler";

import { seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ClassifyFeedbackHandler)]);

function answer(content: Record<string, unknown>): ChatCompletion {
  return { content: JSON.stringify(content), toolCalls: [], finishReason: "stop", usage: null };
}

function judgments(values: Record<string, number>): JevJudgments {
  return { model: "jev-1.14.0", values, inputTokens: 100 };
}

describe(ClassifyFeedbackHandler.name, () => {
  const config = container.resolve(FEEDBACK_CONFIG);
  const configuredEngine = config.FEEDBACK_CLASSIFIER_ENGINE;

  afterEach(() => {
    vi.restoreAllMocks();
    config.FEEDBACK_CLASSIFIER_ENGINE = configuredEngine;
  });

  it("classifies a submission and starts its theme, run the way a worker runs it", async () => {
    const { submission, classify, answerWith, findSubmission, findTheme } = await setup({ message: "please add arm64 machines" });
    answerWith(answer({ type: "feature_request", summary: "Wants arm64 machines", sentiment: 0.1, endedStuck: null }));

    await classify();

    const classified = await findSubmission(submission.id);
    expect(classified).toMatchObject({
      classificationType: "feature_request",
      classificationSummary: "Wants arm64 machines",
      sentimentScore: 0.1,
      endedStuck: null,
      classifiedAt: expect.any(Date)
    });
    expect(await findTheme(classified?.themeId)).toMatchObject({
      title: "Wants arm64 machines",
      type: "feature_request",
      status: "open",
      itemCount: 1,
      distinctUserCount: 1,
      score: expect.any(Number)
    });
    expect((await findTheme(classified?.themeId))?.score).toBeGreaterThan(0);
  });

  it("files a submission under the existing theme the model matched", async () => {
    const theme = await seedFeedbackTheme({ type: "ux_friction", title: "Bid list is confusing", lastSeenAt: new Date() });
    const { submission, classify, answerWith, findSubmission, findTheme } = await setup({ message: "I cannot tell which bid to pick" });
    answerWith(
      answer({ type: "ux_friction", summary: "Hard to choose between bids", sentiment: -0.4, endedStuck: false }),
      answer({ themeKey: "T1", title: null, summary: null })
    );

    await classify();

    expect(await findSubmission(submission.id)).toMatchObject({ themeId: theme.id });
    expect(await findTheme(theme.id)).toMatchObject({ itemCount: 1, distinctUserCount: 1 });
  });

  describe("when Jev is the configured engine", () => {
    const ITEM_JUDGMENTS = judgments({
      type_bug: 0.1,
      type_ux_friction: 0.9,
      type_feature_request: 0.2,
      type_support_question: 0.3,
      sentiment: 1,
      ended_stuck: 0.1,
      not_stuck: 0.9
    });

    it("classifies a submission from Jev judgments and files it under the theme Jev matched", async () => {
      const theme = await seedFeedbackTheme({ type: "ux_friction", title: "Bid list is confusing", lastSeenAt: new Date() });
      const { submission, classify, answerWith, judgeWith, findSubmission, findTheme } = await setup({ message: "I cannot tell which bid to pick" });
      config.FEEDBACK_CLASSIFIER_ENGINE = "jev";
      answerWith(answer({ summary: "Hard to choose between bids" }));
      judgeWith(ITEM_JUDGMENTS, judgments({ theme_0: 0.95 }));

      await classify();

      expect(await findSubmission(submission.id)).toMatchObject({
        classificationType: "ux_friction",
        classificationSummary: "Hard to choose between bids",
        sentimentScore: -0.5,
        endedStuck: false,
        classifiedAt: expect.any(Date),
        themeId: theme.id
      });
      expect(await findTheme(theme.id)).toMatchObject({ itemCount: 1, distinctUserCount: 1 });
    });

    it("starts a theme titled by AkashML when no open theme matches", async () => {
      await seedFeedbackTheme({ type: "ux_friction", title: "Shell drops", lastSeenAt: new Date() });
      const { submission, classify, answerWith, judgeWith, findSubmission, findTheme } = await setup({ message: "I cannot tell which bid to pick" });
      config.FEEDBACK_CLASSIFIER_ENGINE = "jev";
      answerWith(answer({ summary: "Hard to choose between bids" }), answer({ themeKey: null, title: "Choosing a bid", summary: "Bids are hard to compare" }));
      judgeWith(ITEM_JUDGMENTS, judgments({ theme_0: 0.05 }));

      await classify();

      const classified = await findSubmission(submission.id);
      expect(await findTheme(classified?.themeId)).toMatchObject({
        title: "Choosing a bid",
        summary: "Bids are hard to compare",
        type: "ux_friction",
        itemCount: 1
      });
    });
  });

  it("leaves a submission with text for the backfill while the model is unavailable", async () => {
    const { submission, classify, findSubmission } = await setup({ message: "logs never load", isAvailable: false });

    await classify();

    expect(await findSubmission(submission.id)).toMatchObject({ classifiedAt: null, themeId: null });
  });

  it("gives up on a submission whose last attempt the model answered unusably", async () => {
    const { submission, classify, answerWith, findSubmission } = await setup({
      message: "logs never load",
      classificationAttempts: MAX_CLASSIFICATION_ATTEMPTS - 1
    });
    answerWith({ content: "not json at all", toolCalls: [], finishReason: "stop", usage: null });

    await classify();

    expect(await findSubmission(submission.id)).toMatchObject({
      classifiedAt: null,
      classificationAttempts: MAX_CLASSIFICATION_ATTEMPTS,
      classificationFailedAt: expect.any(Date)
    });
  });

  it("queues one job per submission while it is still waiting", async () => {
    const { submission, enqueue } = await setup({ message: "anything" });
    const notYetDue = { ...classifyFeedbackOptionsFor(submission.id), startAfter: addHours(new Date(), 1).toISOString() };

    await enqueue(new ClassifyFeedback({ feedbackSubmissionId: submission.id }), notYetDue);
    await enqueue(new ClassifyFeedback({ feedbackSubmissionId: submission.id }), notYetDue);

    expect(await findJobRows(ClassifyFeedback[JOB_NAME], { data: { feedbackSubmissionId: submission.id } })).toHaveLength(1);
  });

  async function setup(input: { message: string; isAvailable?: boolean; classificationAttempts?: number }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet();
    const submission = await seedFeedbackSubmission({
      userId: user.id,
      kind: "general",
      outcome: null,
      dseq: null,
      category: "other",
      rating: null,
      message: input.message,
      classificationAttempts: input.classificationAttempts
    });
    const akashMlClient = container.resolve(AkashMlClient);
    vi.spyOn(akashMlClient, "isAvailable").mockReturnValue(input.isAvailable ?? true);
    const createChatCompletion = vi.spyOn(akashMlClient, "createChatCompletion").mockRejectedValue(new Error("Unexpected model call"));

    function answerWith(...completions: ChatCompletion[]) {
      completions.forEach(completion => createChatCompletion.mockResolvedValueOnce(completion));
    }

    const typeSafeClient = container.resolve(TypeSafeClient);
    vi.spyOn(typeSafeClient, "isAvailable").mockReturnValue(true);
    const judge = vi.spyOn(typeSafeClient, "judge").mockRejectedValue(new Error("Unexpected Jev call"));

    function judgeWith(...answers: JevJudgments[]) {
      answers.forEach(answer => judge.mockResolvedValueOnce(answer));
    }

    async function classify() {
      const options = classifyFeedbackOptionsFor(submission.id);
      await enqueue(new ClassifyFeedback({ feedbackSubmissionId: submission.id }), options);
      await startWorkers();
      await expectJobCompleted(ClassifyFeedback[JOB_NAME], { singletonKey: options.singletonKey as string });
    }

    return {
      submission,
      enqueue,
      classify,
      answerWith,
      judgeWith,
      findSubmission: (id: string) => container.resolve(FeedbackSubmissionRepository).findById(id),
      findTheme: (id: string | null | undefined) => container.resolve(FeedbackThemeRepository).findById(id as string)
    };
  }
});
