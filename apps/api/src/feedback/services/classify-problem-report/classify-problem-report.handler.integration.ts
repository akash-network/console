import { addHours } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { AssistantProblemReportRepository } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient, type ChatCompletion } from "@src/feedback/services/akashml-client/akashml.client";
import { PROBLEM_REPORT_NOTE_PREFIX } from "@src/feedback/services/feedback-classification/feedback-classification.service";
import { ClassifyProblemReport, ClassifyProblemReportHandler, classifyProblemReportOptionsFor } from "./classify-problem-report.handler";

import { seedAssistantConversation, seedAssistantMessage, seedAssistantProblemReport } from "@test/seeders/db/feedback.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ClassifyProblemReportHandler)]);

function answer(content: Record<string, unknown>): ChatCompletion {
  return { content: JSON.stringify(content), toolCalls: [], finishReason: "stop", usage: null };
}

describe(ClassifyProblemReportHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies a report from its transcript and note and starts its theme, run the way a worker runs it", async () => {
    const { user, classify, answerWith, modelInputs, findReport, findTheme } = await setup();
    const report = await seedAssistantProblemReport({
      userId: user.id,
      note: "It suggested a GPU no provider has",
      transcript: [
        { role: "user", content: "Why no bids?" },
        { role: "assistant", content: "Ask for an H900." }
      ]
    });
    answerWith(answer({ type: "bug", summary: "Assistant suggests unavailable GPUs", sentiment: -0.6, endedStuck: true }));

    await classify(report.id);

    const classified = await findReport(report.id);
    expect(classified).toMatchObject({
      classificationType: "bug",
      classificationSummary: "Assistant suggests unavailable GPUs",
      sentimentScore: -0.6,
      endedStuck: true,
      classifiedAt: expect.any(Date)
    });
    expect(await findTheme(classified?.themeId)).toMatchObject({
      title: "Assistant suggests unavailable GPUs",
      type: "bug",
      itemCount: 1,
      distinctUserCount: 1
    });
    expect(modelInputs()[0]).toContain("Ask for an H900.");
    expect(modelInputs()[0]).toContain(`${PROBLEM_REPORT_NOTE_PREFIX}It suggested a GPU no provider has`);
  });

  it("reads a stored conversation's report from the stored messages", async () => {
    const { user, classify, answerWith, modelInputs, findReport } = await setup();
    const conversation = await seedAssistantConversation({ userId: user.id });
    await seedAssistantMessage({ conversationId: conversation.id, role: "user", content: "My lease closed overnight" });
    const report = await seedAssistantProblemReport({ userId: user.id, conversationId: conversation.id, transcript: null });
    answerWith(answer({ type: "support_question", summary: "Lease closed unexpectedly", sentiment: -0.2, endedStuck: null }));

    await classify(report.id);

    expect(await findReport(report.id)).toMatchObject({ classificationType: "support_question", classifiedAt: expect.any(Date) });
    expect(modelInputs()[0]).toContain("My lease closed overnight");
  });

  it("queues one job per report while it is still waiting", async () => {
    const { user, enqueue } = await setup();
    const report = await seedAssistantProblemReport({ userId: user.id });
    const notYetDue = { ...classifyProblemReportOptionsFor(report.id), startAfter: addHours(new Date(), 1).toISOString() };

    await enqueue(new ClassifyProblemReport({ problemReportId: report.id }), notYetDue);
    await enqueue(new ClassifyProblemReport({ problemReportId: report.id }), notYetDue);

    expect(await findJobRows(ClassifyProblemReport[JOB_NAME], { data: { problemReportId: report.id } })).toHaveLength(1);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet();
    const akashMlClient = container.resolve(AkashMlClient);
    vi.spyOn(akashMlClient, "isAvailable").mockReturnValue(true);
    const createChatCompletion = vi.spyOn(akashMlClient, "createChatCompletion").mockRejectedValue(new Error("Unexpected model call"));

    function answerWith(...completions: ChatCompletion[]) {
      completions.forEach(completion => createChatCompletion.mockResolvedValueOnce(completion));
    }

    function modelInputs(): string[] {
      return createChatCompletion.mock.calls.map(([request]) => request.messages.map(({ content }) => content ?? "").join("\n"));
    }

    async function classify(problemReportId: string) {
      const options = classifyProblemReportOptionsFor(problemReportId);
      await enqueue(new ClassifyProblemReport({ problemReportId }), options);
      await startWorkers();
      await expectJobCompleted(ClassifyProblemReport[JOB_NAME], { singletonKey: options.singletonKey as string });
    }

    return {
      user,
      enqueue,
      classify,
      answerWith,
      modelInputs,
      findReport: (id: string) => container.resolve(AssistantProblemReportRepository).findById(id),
      findTheme: (id: string | null | undefined) => container.resolve(FeedbackThemeRepository).findById(id as string)
    };
  }
});
