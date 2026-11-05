import { addHours } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient, type ChatCompletion } from "@src/feedback/services/akashml-client/akashml.client";
import { ClassifyFeedback, ClassifyFeedbackHandler, classifyFeedbackOptionsFor } from "./classify-feedback.handler";

import { seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ClassifyFeedbackHandler)]);

function answer(content: Record<string, unknown>): ChatCompletion {
  return { content: JSON.stringify(content), toolCalls: [], finishReason: "stop", usage: null };
}

describe(ClassifyFeedbackHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it("leaves a submission with text for the backfill while the model is unavailable", async () => {
    const { submission, classify, findSubmission } = await setup({ message: "logs never load", isAvailable: false });

    await classify();

    expect(await findSubmission(submission.id)).toMatchObject({ classifiedAt: null, themeId: null });
  });

  it("queues one job per submission while it is still waiting", async () => {
    const { submission, enqueue } = await setup({ message: "anything" });
    const notYetDue = { ...classifyFeedbackOptionsFor(submission.id), startAfter: addHours(new Date(), 1).toISOString() };

    await enqueue(new ClassifyFeedback({ feedbackSubmissionId: submission.id }), notYetDue);
    await enqueue(new ClassifyFeedback({ feedbackSubmissionId: submission.id }), notYetDue);

    expect(await findJobRows(ClassifyFeedback[JOB_NAME], { data: { feedbackSubmissionId: submission.id } })).toHaveLength(1);
  });

  async function setup(input: { message: string; isAvailable?: boolean }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet();
    const submission = await seedFeedbackSubmission({ userId: user.id, kind: "general", outcome: null, dseq: null, category: "other", message: input.message });
    const akashMlClient = container.resolve(AkashMlClient);
    vi.spyOn(akashMlClient, "isAvailable").mockReturnValue(input.isAvailable ?? true);
    const createChatCompletion = vi.spyOn(akashMlClient, "createChatCompletion").mockRejectedValue(new Error("Unexpected model call"));

    function answerWith(...completions: ChatCompletion[]) {
      completions.forEach(completion => createChatCompletion.mockResolvedValueOnce(completion));
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
      findSubmission: (id: string) => container.resolve(FeedbackSubmissionRepository).findById(id),
      findTheme: (id: string | null | undefined) => container.resolve(FeedbackThemeRepository).findById(id as string)
    };
  }
});
