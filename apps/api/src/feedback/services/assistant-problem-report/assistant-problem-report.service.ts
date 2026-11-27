import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { CreateAssistantProblemReportRequest, CreateAssistantProblemReportResponse } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { ASSISTANT_ERROR_CODES } from "@src/feedback/lib/assistant-errors/assistant-errors";
import { redactSecrets, redactSecretStrings } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { ReportedTranscriptMessage } from "@src/feedback/model-schemas";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantProblemReportRepository } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import { AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";
import { AssistantAnswerSigner } from "@src/feedback/services/assistant-answer-signer/assistant-answer-signer.service";
import { ClassifyProblemReport, classifyProblemReportOptionsFor } from "@src/feedback/services/classify-problem-report/classify-problem-report.handler";
import { NotifyProblemReport } from "@src/feedback/services/notify-problem-report/notify-problem-report.handler";

export const DAILY_PROBLEM_REPORT_LIMIT = 10;

type ReportInput = CreateAssistantProblemReportRequest["data"];
type ClientHistory = NonNullable<ReportInput["history"]>;

@singleton()
export class AssistantProblemReportService {
  constructor(
    private readonly assistantProblemReportRepository: AssistantProblemReportRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly assistantTurnTraceRepository: AssistantTurnTraceRepository,
    private readonly assistantUserUsageRepository: AssistantUserUsageRepository,
    private readonly answerSigner: AssistantAnswerSigner,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService
  ) {}

  /** A stored conversation is referenced rather than copied, so only an unstored one sends its signed history along. */
  async create(conversationId: string, { turnId, note, copyVersion, history }: ReportInput): Promise<CreateAssistantProblemReportResponse["data"]> {
    const userId = this.authService.currentUser.id;
    const storedConversation = await this.assistantConversationRepository
      .accessibleBy(this.authService.ability, "read")
      .findOneBy({ id: conversationId, userId });
    const transcript = storedConversation ? null : this.#verifiedTranscript(conversationId, history ?? []);
    const turn = turnId ? await this.assistantTurnTraceRepository.findTurnOf({ id: turnId, userId, conversationId }) : undefined;

    return await this.txService.transaction(async () => {
      await this.#countWithinDailyLimit(userId);

      const report = await this.assistantProblemReportRepository.accessibleBy(this.authService.ability, "create").create({
        userId,
        organizationId: this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId ?? null,
        conversationId,
        turnTraceId: turn?.id ?? null,
        note: note ? redactSecrets(note) : null,
        transcript,
        consentCopyVersion: copyVersion
      });

      await this.jobQueueService.enqueue(new ClassifyProblemReport({ problemReportId: report.id }), classifyProblemReportOptionsFor(report.id));
      await this.jobQueueService.enqueue(new NotifyProblemReport({ problemReportId: report.id }));

      return { id: report.id };
    });
  }

  /** The report keeps this transcript, so a single answer that fails its check rejects the whole report. */
  #verifiedTranscript(conversationId: string, history: ClientHistory): ReportedTranscriptMessage[] {
    const userId = this.authService.currentUser.id;
    const isVerified = ({ role, content, signature }: ClientHistory[number]) =>
      role === "user" || (!!signature && this.answerSigner.verifies({ userId, conversationId, text: content, signature }));

    if (!history.every(isVerified)) {
      throw createError(400, "The conversation sent with this report does not match what Sidekick answered.", {
        errorCode: ASSISTANT_ERROR_CODES.historyUnverified
      });
    }

    return history.map(({ role, content }) => redactSecretStrings({ role, content }));
  }

  /** Runs inside the report's transaction, so a refused or failed report never counts against the limit. */
  async #countWithinDailyLimit(userId: string): Promise<void> {
    const sentToday = await this.assistantUserUsageRepository.countProblemReport(userId, new Date());

    if (sentToday > DAILY_PROBLEM_REPORT_LIMIT) {
      throw createError(429, `You can report up to ${DAILY_PROBLEM_REPORT_LIMIT} problems a day. Try again tomorrow.`, {
        errorCode: ASSISTANT_ERROR_CODES.reportLimit
      });
    }
  }
}
