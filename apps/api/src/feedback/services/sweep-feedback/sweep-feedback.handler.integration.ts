import { addHours, differenceInMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import {
  ClassifyConversation,
  ClassifyConversationHandler,
  classifyConversationOptionsFor
} from "@src/feedback/services/classify-conversation/classify-conversation.handler";
import { ClassifyFeedback, ClassifyFeedbackHandler, classifyFeedbackOptionsFor } from "@src/feedback/services/classify-feedback/classify-feedback.handler";
import { SWEEP_FEEDBACK_KEY, SweepFeedback, SweepFeedbackHandler } from "./sweep-feedback.handler";

import { seedAssistantConversation, seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [
  container.resolve(SweepFeedbackHandler),
  container.resolve(ClassifyFeedbackHandler),
  container.resolve(ClassifyConversationHandler)
]);

describe(SweepFeedbackHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies what was left unclassified, rescores themes and queues the next sweep, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet({ isTrialing: false });
    const unclassified = await seedFeedbackSubmission({ userId: user.id, message: null, rating: 5 });
    const conversation = await seedAssistantConversation({ userId: user.id, endedAt: new Date() });
    const theme = await seedFeedbackTheme({ score: 0 });
    await seedFeedbackSubmission({ userId: user.id, themeId: theme.id, classifiedAt: new Date(), rating: 1 });
    const akashMlClient = container.resolve(AkashMlClient);
    vi.spyOn(akashMlClient, "isAvailable").mockReturnValue(true);
    vi.spyOn(akashMlClient, "createChatCompletion").mockRejectedValue(new Error("Unexpected model call"));

    await enqueue(new SweepFeedback(), { singletonKey: "firstSweep" });
    await startWorkers();
    await expectJobCompleted(SweepFeedback[JOB_NAME], { singletonKey: "firstSweep" });

    await expectJobCompleted(ClassifyFeedback[JOB_NAME], { singletonKey: classifyFeedbackOptionsFor(unclassified.id).singletonKey as string });
    expect(await container.resolve(FeedbackSubmissionRepository).findById(unclassified.id)).toMatchObject({
      sentimentScore: 1,
      classifiedAt: expect.any(Date)
    });
    await expectJobCompleted(ClassifyConversation[JOB_NAME], { singletonKey: classifyConversationOptionsFor(conversation.id).singletonKey as string });
    expect(await container.resolve(AssistantConversationRepository).findById(conversation.id)).toMatchObject({ classifiedAt: expect.any(Date) });
    expect((await container.resolve(FeedbackThemeRepository).findById(theme.id))?.score).toBeGreaterThan(0);

    const [nextSweep] = await findJobRows(SweepFeedback[JOB_NAME], { singletonKey: SWEEP_FEEDBACK_KEY });
    expect(nextSweep.state).toBe("created");
    expect(Math.abs(differenceInMinutes(new Date(nextSweep.start_after), addHours(new Date(), 1)))).toBeLessThanOrEqual(1);
  });
});
