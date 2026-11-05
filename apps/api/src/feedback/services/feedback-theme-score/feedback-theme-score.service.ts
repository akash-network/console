import { inject, singleton } from "tsyringe";

import { scoreFeedbackTheme } from "@src/feedback/lib/feedback-theme-score/feedback-theme-score";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";

export const RESCORE_BATCH_SIZE = 200;

@singleton()
export class FeedbackThemeScoreService {
  constructor(
    private readonly feedbackThemeRepository: FeedbackThemeRepository,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig
  ) {}

  async rescore(themeIds: string[], now = new Date()): Promise<void> {
    const uniqueThemeIds = [...new Set(themeIds)];
    const signals = await this.feedbackThemeRepository.findScoreSignals(uniqueThemeIds);

    for (const themeId of uniqueThemeIds) {
      const themeSignals = signals.filter(signal => signal.themeId === themeId);
      await this.feedbackThemeRepository.updateScore(themeId, scoreFeedbackTheme(themeSignals, this.config.FEEDBACK_THEME_SCORE_WEIGHTS, now));
    }
  }

  /** Recency decays with time alone, so every theme still ranked is rescored even when nothing new joined it. */
  async rescoreAll(now = new Date()): Promise<number> {
    let rescored = 0;
    let afterId: string | null = null;

    while (true) {
      const themeIds: string[] = await this.feedbackThemeRepository.findRankableIds(afterId, RESCORE_BATCH_SIZE);
      if (themeIds.length === 0) break;

      await this.rescore(themeIds, now);
      rescored += themeIds.length;
      afterId = themeIds[themeIds.length - 1];
    }

    return rescored;
  }
}
