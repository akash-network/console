import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantProblemReportRepository } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";

@singleton()
export class FeedbackErasureService {
  constructor(
    private readonly feedbackSubmissionRepository: FeedbackSubmissionRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly assistantProblemReportRepository: AssistantProblemReportRepository,
    private readonly feedbackThemeRepository: FeedbackThemeRepository,
    private readonly assistantTurnTraceRepository: AssistantTurnTraceRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService
  ) {}

  async eraseOwnConversations(): Promise<number> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      const { deletedCount, themeIds } = await this.assistantConversationRepository.accessibleBy(this.authService.ability, "delete").deleteAllOf(userId);
      const reportThemeIds = await this.assistantProblemReportRepository.accessibleBy(this.authService.ability, "delete").deleteAllOf(userId);
      await this.feedbackThemeRepository.refreshCounts([...themeIds, ...reportThemeIds]);
      await this.assistantTurnTraceRepository.deleteAllOf(userId);

      return deletedCount;
    });
  }

  /** The user row cascades these too; deleting them first is what lets the themes they fed be recounted. */
  async eraseAccountFeedback(userId: string): Promise<void> {
    await this.txService.transaction(async () => {
      const submissionThemeIds = await this.feedbackSubmissionRepository.deleteAllOf(userId);
      const { themeIds: conversationThemeIds } = await this.assistantConversationRepository.deleteAllOf(userId);
      const reportThemeIds = await this.assistantProblemReportRepository.deleteAllOf(userId);
      await this.feedbackThemeRepository.refreshCounts([...submissionThemeIds, ...conversationThemeIds, ...reportThemeIds]);
      await this.assistantTurnTraceRepository.deleteAllOf(userId);
    });
  }
}
