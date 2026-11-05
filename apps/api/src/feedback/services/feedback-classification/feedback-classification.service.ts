import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import {
  buildConversationClassificationMessages,
  buildSubmissionClassificationMessages,
  classifyWithoutText,
  FEEDBACK_CLASSIFICATION_SCHEMA,
  type FeedbackClassification,
  hasTextToClassify
} from "@src/feedback/lib/feedback-classification-prompt/feedback-classification-prompt";
import type { ItemToMatch, ThemeMatch } from "@src/feedback/lib/feedback-theme-match-prompt/feedback-theme-match-prompt";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient, type ChatMessage } from "@src/feedback/services/akashml-client/akashml.client";
import { FeedbackThemeAssignmentService } from "@src/feedback/services/feedback-theme-assignment/feedback-theme-assignment.service";
import { FeedbackThemeScoreService } from "@src/feedback/services/feedback-theme-score/feedback-theme-score.service";

type ClassifiedFields = {
  classificationType: FeedbackClassification["type"];
  classificationSummary: string | null;
  sentimentScore: number;
  endedStuck: boolean | null;
  classifiedAt: Date;
  themeId: string | null;
};

type SaveClassification = (fields: ClassifiedFields) => Promise<unknown>;

function itemToMatchOf(classification: FeedbackClassification): ItemToMatch | null {
  return classification.type && classification.summary ? { type: classification.type, summary: classification.summary } : null;
}

/** Items already classified are left alone, so a redelivered job or a backfill racing a fresh enqueue costs no model call. */
@singleton()
export class FeedbackClassificationService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly feedbackSubmissionRepository: FeedbackSubmissionRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly assistantMessageRepository: AssistantMessageRepository,
    private readonly feedbackThemeRepository: FeedbackThemeRepository,
    private readonly feedbackThemeAssignmentService: FeedbackThemeAssignmentService,
    private readonly feedbackThemeScoreService: FeedbackThemeScoreService,
    private readonly akashMlClient: AkashMlClient,
    private readonly txService: TxService,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FeedbackClassificationService.name });
  }

  async classifySubmission(feedbackSubmissionId: string): Promise<void> {
    const submission = await this.feedbackSubmissionRepository.findById(feedbackSubmissionId);
    if (!submission || submission.dismissed || submission.classifiedAt) return;

    const save: SaveClassification = fields => this.feedbackSubmissionRepository.updateById(feedbackSubmissionId, fields);

    if (!hasTextToClassify(submission)) {
      await this.#store(classifyWithoutText(submission.rating), null, save);
      return;
    }

    if (!this.#isModelAvailable({ feedbackSubmissionId })) return;

    await this.#classifyWithModel(buildSubmissionClassificationMessages(submission), save);
  }

  async classifyConversation(conversationId: string): Promise<void> {
    const conversation = await this.assistantConversationRepository.findById(conversationId);
    if (!conversation || conversation.classifiedAt || !this.#isModelAvailable({ conversationId })) return;

    const messages = await this.assistantMessageRepository.findAllOf(conversationId);
    const save: SaveClassification = fields => this.assistantConversationRepository.updateById(conversationId, fields);

    if (!messages.some(({ role }) => role === "user")) {
      await this.#store(classifyWithoutText(null), null, save);
      return;
    }

    await this.#classifyWithModel(buildConversationClassificationMessages({ ...conversation, messages }), save);
  }

  #isModelAvailable(item: Record<string, string>): boolean {
    if (this.akashMlClient.isAvailable()) return true;

    this.#logger.info({ event: "FEEDBACK_CLASSIFICATION_DEFERRED", reason: "model_unavailable", ...item });
    return false;
  }

  async #classifyWithModel(messages: ChatMessage[], save: SaveClassification): Promise<void> {
    const classification = await this.akashMlClient.completeJson({
      model: this.config.FEEDBACK_CLASSIFIER_MODEL,
      messages,
      schema: FEEDBACK_CLASSIFICATION_SCHEMA,
      temperature: 0
    });
    const item = itemToMatchOf(classification);
    const match = item ? { item, theme: await this.feedbackThemeAssignmentService.findMatch(item) } : null;

    await this.#store(classification, match, save);
  }

  /** Model calls happen before this point, so the transaction only spans the writes. */
  async #store(classification: FeedbackClassification, match: { item: ItemToMatch; theme: ThemeMatch } | null, save: SaveClassification): Promise<void> {
    await this.txService.transaction(async () => {
      const themeId = match ? await this.feedbackThemeAssignmentService.themeIdFor(match.theme, match.item) : null;

      await save({
        classificationType: classification.type,
        classificationSummary: classification.summary,
        sentimentScore: classification.sentimentScore,
        endedStuck: classification.endedStuck,
        classifiedAt: new Date(),
        themeId
      });

      if (themeId) {
        await this.feedbackThemeRepository.refreshCounts([themeId]);
        await this.feedbackThemeScoreService.rescore([themeId]);
      }
    });
  }
}
