import { faker } from "@faker-js/faker";
import { addHours, differenceInMinutes, subDays, subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
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

  it("classifies what was left unclassified, rescores themes, drops expired assistant turns and queues the next sweep, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet({ isTrialing: false });
    const unclassified = await seedFeedbackSubmission({ userId: user.id, message: null, rating: 5 });
    const conversation = await seedAssistantConversation({ userId: user.id, endedAt: new Date() });
    const theme = await seedFeedbackTheme({ score: 0 });
    await seedFeedbackSubmission({ userId: user.id, themeId: theme.id, classifiedAt: new Date(), rating: 1 });
    const pendingTurns = container.resolve(AssistantPendingTurnRepository);
    const state = { messages: [], clientToolCalls: [], roundsUsed: 1, stored: false, isTrialing: false };
    const expiredConversationId = faker.string.uuid();
    const liveConversationId = faker.string.uuid();
    await pendingTurns.hold({ conversationId: expiredConversationId, userId: user.id, state, expiresAt: subMinutes(new Date(), 1) });
    await pendingTurns.hold({ conversationId: liveConversationId, userId: user.id, state, expiresAt: addHours(new Date(), 1) });
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
    expect(await pendingTurns.take(expiredConversationId, user.id, new Date(0))).toBeUndefined();
    expect(await pendingTurns.take(liveConversationId, user.id, new Date())).toMatchObject({ state });

    const [nextSweep] = await findJobRows(SweepFeedback[JOB_NAME], { singletonKey: SWEEP_FEEDBACK_KEY });
    expect(nextSweep.state).toBe("created");
    expect(Math.abs(differenceInMinutes(new Date(nextSweep.start_after), addHours(new Date(), 1)))).toBeLessThanOrEqual(1);
  });

  it("deletes turn traces older than 90 days on each sweep", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet({ isTrialing: false });
    const conversationId = faker.string.uuid();
    const traces = container.resolve(AssistantTurnTraceRepository);
    const trace = { userId: user.id, conversationId, model: "assistant-model", promptVersion: "2026-11-08", outcome: "answered" as const, durationMs: 1000 };
    const recentStartedAt = subDays(new Date(), 89);
    await traces.create({ ...trace, startedAt: subDays(new Date(), 91) });
    await traces.create({ ...trace, startedAt: recentStartedAt });
    vi.spyOn(container.resolve(AkashMlClient), "isAvailable").mockReturnValue(false);

    await enqueue(new SweepFeedback(), { singletonKey: "traceSweep" });
    await startWorkers();
    await expectJobCompleted(SweepFeedback[JOB_NAME], { singletonKey: "traceSweep" });

    const table = resolveTable("AssistantTurnTraces");
    const remaining = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(table).where(eq(table.conversationId, conversationId));
    expect(remaining).toEqual([expect.objectContaining({ startedAt: recentStartedAt })]);
  });
});
