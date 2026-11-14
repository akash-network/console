import type { MongoAbility } from "@casl/ability";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { envSchema } from "@src/feedback/config/env.config";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { AssistantProblemReportRepository } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";
import type { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import { AssistantAnswerSigner } from "@src/feedback/services/assistant-answer-signer/assistant-answer-signer.service";
import { ClassifyProblemReport, classifyProblemReportOptionsFor } from "@src/feedback/services/classify-problem-report/classify-problem-report.handler";
import { NotifyProblemReport } from "@src/feedback/services/notify-problem-report/notify-problem-report.handler";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { AssistantProblemReportService, DAILY_PROBLEM_REPORT_LIMIT } from "./assistant-problem-report.service";

import { createAssistantConversation } from "@test/seeders/assistant-conversation.seeder";
import { createAssistantProblemReport } from "@test/seeders/assistant-problem-report.seeder";

const CONVERSATION_ID = "5b0e8f1c-2d3a-4b5c-8d6e-7f8091a2b3c4";
const TURN_ID = "0e9d1c52-3f2a-4f7e-8b6c-5a4d3c2b1a00";
const COPY_VERSION = "2026-11-14";
const FAKE_TOKEN = `ghp_${"Z9y8X7w6V5".repeat(3)}`;

describe(AssistantProblemReportService.name, () => {
  describe("create", () => {
    it("saves an unstored conversation's verified and redacted history with the note, turn and consent version", async () => {
      const { service, signer, problemReportRepository, turnTraceRepository } = setup({ organizationId: "org-1" });
      turnTraceRepository.findTurnOf.mockResolvedValue({ id: TURN_ID, outcome: "answered", model: "assistant-model" });

      const result = await service.create(CONVERSATION_ID, {
        turnId: TURN_ID,
        note: `It told me to paste ${FAKE_TOKEN}`,
        copyVersion: COPY_VERSION,
        history: [
          { role: "user", content: `My token is ${FAKE_TOKEN}` },
          {
            role: "assistant",
            content: "Do not share it.",
            signature: signer.sign({ userId: "user-1", conversationId: CONVERSATION_ID, text: "Do not share it." })
          }
        ]
      });

      expect(result).toEqual({ id: "report-1" });
      expect(turnTraceRepository.findTurnOf).toHaveBeenCalledWith({ id: TURN_ID, userId: "user-1", conversationId: CONVERSATION_ID });
      expect(problemReportRepository.create).toHaveBeenCalledWith({
        userId: "user-1",
        organizationId: "org-1",
        conversationId: CONVERSATION_ID,
        turnTraceId: TURN_ID,
        note: `It told me to paste ${REDACTED}`,
        transcript: [
          { role: "user", content: `My token is ${REDACTED}` },
          { role: "assistant", content: "Do not share it." }
        ],
        consentCopyVersion: COPY_VERSION
      });
    });

    it("references a stored conversation instead of copying the history the client sent", async () => {
      const { service, conversationRepository, problemReportRepository, authService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(createAssistantConversation({ id: CONVERSATION_ID, userId: "user-1" }));

      await service.create(CONVERSATION_ID, {
        copyVersion: COPY_VERSION,
        history: [{ role: "assistant", content: "Unsigned answer" }]
      });

      expect(conversationRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(conversationRepository.findOneBy).toHaveBeenCalledWith({ id: CONVERSATION_ID, userId: "user-1" });
      expect(problemReportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: null, note: null, turnTraceId: null, organizationId: null })
      );
    });

    it("saves an empty transcript for an unstored conversation sent without history", async () => {
      const { service, problemReportRepository, turnTraceRepository } = setup();

      await service.create(CONVERSATION_ID, { copyVersion: COPY_VERSION });

      expect(turnTraceRepository.findTurnOf).not.toHaveBeenCalled();
      expect(problemReportRepository.create).toHaveBeenCalledWith(expect.objectContaining({ transcript: [] }));
    });

    it("leaves the turn out when the user has no such turn in the conversation", async () => {
      const { service, problemReportRepository, turnTraceRepository } = setup();
      turnTraceRepository.findTurnOf.mockResolvedValue(undefined);

      await service.create(CONVERSATION_ID, { turnId: TURN_ID, copyVersion: COPY_VERSION });

      expect(problemReportRepository.create).toHaveBeenCalledWith(expect.objectContaining({ turnTraceId: null }));
    });

    it.each([
      { name: "an assistant message without a signature", signature: undefined },
      { name: "an assistant message changed after it was signed", signature: "signature-of-something-else" }
    ])("rejects $name and saves nothing", async ({ signature }) => {
      const { service, problemReportRepository, jobQueueService } = setup();

      await expect(
        service.create(CONVERSATION_ID, {
          copyVersion: COPY_VERSION,
          history: [
            { role: "user", content: "Hi" },
            { role: "assistant", content: "Hello", signature }
          ]
        })
      ).rejects.toMatchObject({ status: 400, errorCode: "assistant_history_unverified" });
      expect(problemReportRepository.create).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("rejects an answer signed for another conversation", async () => {
      const { service, signer } = setup();

      await expect(
        service.create(CONVERSATION_ID, {
          copyVersion: COPY_VERSION,
          history: [{ role: "assistant", content: "Hello", signature: signer.sign({ userId: "user-1", conversationId: "other", text: "Hello" }) }]
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it("saves the report, queues its classification and its Slack notice in one transaction, under the locked user", async () => {
      const { service, txService, userRepository, problemReportRepository, jobQueueService, authService } = setup();
      txService.transaction.mockImplementation(async cb => {
        expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
        const result = await cb();
        expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
        return result;
      });

      await service.create(CONVERSATION_ID, { copyVersion: COPY_VERSION });

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: "user-1" }, { strength: "no key update" });
      expect(problemReportRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
      expect(jobQueueService.enqueue.mock.calls).toEqual([
        [new ClassifyProblemReport({ problemReportId: "report-1" }), classifyProblemReportOptionsFor("report-1")],
        [new NotifyProblemReport({ problemReportId: "report-1" })]
      ]);
      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });

    it("counts the reports the user sent over the last day", async () => {
      const { service, problemReportRepository } = setup();
      const before = Date.now();

      await service.create(CONVERSATION_ID, { copyVersion: COPY_VERSION });

      const [userId, since] = problemReportRepository.countSince.mock.calls[0];
      expect(userId).toBe("user-1");
      expect(before - since.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
      expect(Date.now() - since.getTime()).toBeLessThan(24 * 60 * 60 * 1000 + 60_000);
    });

    it("accepts the last report under the daily limit", async () => {
      const { service, problemReportRepository } = setup({ sentToday: DAILY_PROBLEM_REPORT_LIMIT - 1 });

      await service.create(CONVERSATION_ID, { copyVersion: COPY_VERSION });

      expect(problemReportRepository.create).toHaveBeenCalledTimes(1);
    });

    it("refuses a report over the daily limit and queues nothing", async () => {
      const { service, problemReportRepository, jobQueueService } = setup({ sentToday: DAILY_PROBLEM_REPORT_LIMIT });

      await expect(service.create(CONVERSATION_ID, { copyVersion: COPY_VERSION })).rejects.toMatchObject({
        status: 429,
        errorCode: "assistant_report_limit",
        message: `You can report up to ${DAILY_PROBLEM_REPORT_LIMIT} problems a day. Try again tomorrow.`
      });
      expect(problemReportRepository.create).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  function setup(input: { organizationId?: string; sentToday?: number } = {}) {
    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: "user-1" }), ability: mock<MongoAbility>() });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockReturnValue(input.organizationId ? mock<OrganizationContext>({ organizationId: input.organizationId }) : undefined);
    const problemReportRepository = mock<AssistantProblemReportRepository>();
    problemReportRepository.accessibleBy.mockReturnValue(problemReportRepository);
    problemReportRepository.countSince.mockResolvedValue(input.sentToday ?? 0);
    problemReportRepository.create.mockResolvedValue(createAssistantProblemReport({ id: "report-1" }));
    const conversationRepository = mock<AssistantConversationRepository>();
    conversationRepository.accessibleBy.mockReturnValue(conversationRepository);
    conversationRepository.findOneBy.mockResolvedValue(undefined);
    const turnTraceRepository = mock<AssistantTurnTraceRepository>();
    const userRepository = mock<UserRepository>();
    const signer = new AssistantAnswerSigner(envSchema.parse({ ASSISTANT_HISTORY_SIGNING_KEY: "k".repeat(32) }));
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const service = new AssistantProblemReportService(
      problemReportRepository,
      conversationRepository,
      turnTraceRepository,
      userRepository,
      signer,
      authService,
      executionContextService,
      jobQueueService,
      txService
    );

    return {
      service,
      authService,
      signer,
      problemReportRepository,
      conversationRepository,
      turnTraceRepository,
      userRepository,
      jobQueueService,
      txService
    };
  }
});
