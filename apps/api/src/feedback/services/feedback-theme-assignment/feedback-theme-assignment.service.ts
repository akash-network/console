import { inject, singleton } from "tsyringe";

import {
  buildThemeMatchMessages,
  type ItemToMatch,
  type NewTheme,
  newThemeFrom,
  resolveThemeMatch,
  THEME_MATCH_SCHEMA,
  type ThemeMatch
} from "@src/feedback/lib/feedback-theme-match-prompt/feedback-theme-match-prompt";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";

export const MAX_THEME_CANDIDATES = 30;

@singleton()
export class FeedbackThemeAssignmentService {
  constructor(
    private readonly feedbackThemeRepository: FeedbackThemeRepository,
    private readonly akashMlClient: AkashMlClient,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig
  ) {}

  /** Asks the model only when there is a theme to compare against, since a first item of its type always starts one. */
  async findMatch(item: ItemToMatch): Promise<ThemeMatch> {
    const candidates = await this.feedbackThemeRepository.findMatchCandidates(item.type, MAX_THEME_CANDIDATES);
    if (candidates.length === 0) return newThemeFrom(item);

    const output = await this.akashMlClient.completeJson({
      model: this.config.FEEDBACK_CLASSIFIER_MODEL,
      messages: buildThemeMatchMessages(item, candidates),
      schema: THEME_MATCH_SCHEMA,
      temperature: 0
    });

    return resolveThemeMatch(output, item, candidates);
  }

  /** Asks the model for the title and summary of a theme the item starts, by offering it no existing theme to join. */
  async nameNewTheme(item: ItemToMatch): Promise<NewTheme> {
    const output = await this.akashMlClient.completeJson({
      model: this.config.FEEDBACK_CLASSIFIER_MODEL,
      messages: buildThemeMatchMessages(item, []),
      schema: THEME_MATCH_SCHEMA,
      temperature: 0
    });

    return newThemeFrom(item, output);
  }

  /** Follows merges made since the match, and starts a theme from the item when the matched one no longer leads anywhere. */
  async themeIdFor(match: ThemeMatch, item: ItemToMatch): Promise<string> {
    if ("themeId" in match) {
      const activeThemeId = await this.feedbackThemeRepository.resolveActiveId(match.themeId);
      if (activeThemeId) return activeThemeId;
    }

    const { title, summary } = "title" in match ? match : newThemeFrom(item);
    const theme = await this.feedbackThemeRepository.create({ title, summary, type: item.type });

    return theme.id;
  }
}
