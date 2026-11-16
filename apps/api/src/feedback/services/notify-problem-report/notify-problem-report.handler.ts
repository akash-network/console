import { singleton } from "tsyringe";

import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { AssistantProblemReportRepository } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import { AssistantSlackNotifier } from "@src/feedback/services/assistant-slack-notifier/assistant-slack-notifier.service";
import { buildProblemReportSlackMessage } from "./problem-report-slack-message";

export class NotifyProblemReport implements Job {
  static readonly [JOB_NAME] = "NotifyAssistantProblemReport";
  readonly name = NotifyProblemReport[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { problemReportId: string }) {}
}

@singleton()
export class NotifyProblemReportHandler implements JobHandler<NotifyProblemReport> {
  public readonly accepts = NotifyProblemReport;

  constructor(
    private readonly assistantProblemReportRepository: AssistantProblemReportRepository,
    private readonly assistantTurnTraceRepository: AssistantTurnTraceRepository,
    private readonly assistantSlackNotifier: AssistantSlackNotifier
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ problemReportId }: JobPayload<NotifyProblemReport>): Promise<void> {
    const report = await this.assistantProblemReportRepository.findById(problemReportId);
    if (!report) return;

    const turn = report.turnTraceId ? await this.assistantTurnTraceRepository.findTurnById(report.turnTraceId) : undefined;
    const message = buildProblemReportSlackMessage({
      report,
      turn,
      adminConversationUrl: this.assistantSlackNotifier.adminUrlOf(`/assistant/conversations/${report.conversationId}`)
    });

    await this.assistantSlackNotifier.post(message, { problemReportId });
  }
}
