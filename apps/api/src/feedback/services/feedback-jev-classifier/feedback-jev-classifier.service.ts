import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  buildSummaryMessages,
  FEEDBACK_SUMMARY_SCHEMA,
  type FeedbackClassification,
  feedbackItemOf,
  type ItemToClassify
} from "@src/feedback/lib/feedback-classification-prompt/feedback-classification-prompt";
import {
  decideSentiment,
  decideStuck,
  decideTheme,
  decideType,
  ENDED_STUCK_QUESTION_ID,
  ITEM_QUESTIONS,
  itemStateOf,
  NOT_STUCK_QUESTION_ID,
  SENTIMENT_QUESTION_ID,
  stuckFactOf,
  themeQuestionsFor,
  themeStateOf,
  TYPE_PRIORITY,
  typeQuestionId
} from "@src/feedback/lib/feedback-jev-judgments/feedback-jev-judgments";
import { type ItemToMatch, newThemeFrom, type ThemeMatch } from "@src/feedback/lib/feedback-theme-match-prompt/feedback-theme-match-prompt";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import { FeedbackThemeAssignmentService, MAX_THEME_CANDIDATES } from "@src/feedback/services/feedback-theme-assignment/feedback-theme-assignment.service";
import { TypeSafeClient } from "@src/feedback/services/typesafe-client/typesafe.client";

export interface ClassifiedItem {
  classification: FeedbackClassification;
  match: { item: ItemToMatch; theme: ThemeMatch } | null;
}

function ratingOf(item: ItemToClassify): number | null {
  return "submission" in item ? item.submission.rating : null;
}

/** Jev answers small independent questions and the rules in feedback-jev-judgments decide; AkashML only writes the summary and new theme names. */
@singleton()
export class FeedbackJevClassifierService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly typeSafeClient: TypeSafeClient,
    private readonly akashMlClient: AkashMlClient,
    private readonly feedbackThemeRepository: FeedbackThemeRepository,
    private readonly feedbackThemeAssignmentService: FeedbackThemeAssignmentService,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FeedbackJevClassifierService.name });
  }

  isAvailable(): boolean {
    return this.typeSafeClient.isAvailable();
  }

  /** Logs which judgment and which rule produced each field, without any of the item's text, so a wrong result can be traced. */
  async classify(item: ItemToClassify, logContext: Record<string, string>): Promise<ClassifiedItem> {
    const [judgments, summary] = await Promise.all([
      this.typeSafeClient.judge({ model: this.config.FEEDBACK_JEV_MODEL, state: itemStateOf(feedbackItemOf(item)), questions: ITEM_QUESTIONS }),
      this.akashMlClient.completeJson({
        model: this.config.FEEDBACK_CLASSIFIER_MODEL,
        messages: buildSummaryMessages(item),
        schema: FEEDBACK_SUMMARY_SCHEMA,
        temperature: 0
      })
    ]);
    const type = decideType(judgments.values);
    const sentiment = decideSentiment(judgments.values[SENTIMENT_QUESTION_ID], ratingOf(item));
    const stuck =
      ("conversation" in item && stuckFactOf(item.conversation)) ||
      decideStuck(judgments.values[ENDED_STUCK_QUESTION_ID], judgments.values[NOT_STUCK_QUESTION_ID]);
    const itemToMatch = type.type ? { type: type.type, summary } : null;
    const theme = itemToMatch ? await this.#matchTheme(itemToMatch) : null;

    this.#logger.info({
      event: "FEEDBACK_CLASSIFIED_WITH_JEV",
      ...logContext,
      model: judgments.model,
      inputTokens: judgments.inputTokens + (theme?.inputTokens ?? 0),
      type: {
        probabilities: Object.fromEntries(TYPE_PRIORITY.map(name => [name, judgments.values[typeQuestionId(name)]])),
        cleared: type.cleared,
        decided: type.type,
        rule: type.rule
      },
      sentiment: { level: judgments.values[SENTIMENT_QUESTION_ID], rating: ratingOf(item), decided: sentiment.sentimentScore, rule: sentiment.rule },
      stuck: {
        probability: judgments.values[ENDED_STUCK_QUESTION_ID],
        notStuckProbability: judgments.values[NOT_STUCK_QUESTION_ID],
        decided: stuck.endedStuck,
        rule: stuck.rule
      },
      theme: theme?.trace ?? null
    });

    return {
      classification: { type: type.type, summary, sentimentScore: sentiment.sentimentScore, endedStuck: stuck.endedStuck },
      match: itemToMatch && theme ? { item: itemToMatch, theme: theme.match } : null
    };
  }

  async #matchTheme(item: ItemToMatch) {
    const candidates = await this.feedbackThemeRepository.findMatchCandidates(item.type, MAX_THEME_CANDIDATES);
    if (candidates.length === 0) return { match: newThemeFrom(item), inputTokens: 0, trace: { compared: [], rule: "no_open_theme" } };

    const judgments = await this.typeSafeClient.judge({
      model: this.config.FEEDBACK_JEV_MODEL,
      state: themeStateOf(item),
      questions: themeQuestionsFor(candidates)
    });
    const { themeId, ...trace } = decideTheme(judgments.values, candidates);
    const match: ThemeMatch = themeId ? { themeId } : await this.feedbackThemeAssignmentService.nameNewTheme(item);

    return { match, inputTokens: judgments.inputTokens, trace: { ...trace, joined: themeId } };
  }
}
