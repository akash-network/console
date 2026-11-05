import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/feedback/config/env.config";
import type { FeedbackThemeRepository, ThemedScoreSignal } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { FeedbackThemeScoreService, RESCORE_BATCH_SIZE } from "./feedback-theme-score.service";

const NOW = new Date("2026-11-04T12:00:00.000Z");

function signal(overrides: Partial<ThemedScoreSignal> & Pick<ThemedScoreSignal, "themeId" | "userId">): ThemedScoreSignal {
  return {
    seenAt: NOW,
    rating: null,
    sentimentScore: null,
    endedStuck: null,
    deploymentFailed: false,
    isPayingUser: false,
    isFirstWeekUser: false,
    ...overrides
  };
}

describe(FeedbackThemeScoreService.name, () => {
  describe("rescore", () => {
    it("scores each theme from its own signals with the configured weights", async () => {
      const { service, feedbackThemeRepository } = setup({ weights: '{"payingUser":3}' });
      feedbackThemeRepository.findScoreSignals.mockResolvedValue([
        signal({ themeId: "a", userId: "u1", isPayingUser: true }),
        signal({ themeId: "a", userId: "u2" }),
        signal({ themeId: "b", userId: "u1" })
      ]);

      await service.rescore(["a", "b", "a", "c"], NOW);

      expect(feedbackThemeRepository.findScoreSignals).toHaveBeenCalledWith(["a", "b", "c"]);
      expect(feedbackThemeRepository.updateScore.mock.calls).toEqual([
        ["a", 4],
        ["b", 1],
        ["c", 0]
      ]);
    });
  });

  describe("rescoreAll", () => {
    it("pages through every rankable theme and rescores each page", async () => {
      const { service, feedbackThemeRepository } = setup();
      const firstPage = Array.from({ length: RESCORE_BATCH_SIZE }, (_, index) => `theme-${index}`);
      feedbackThemeRepository.findRankableIds.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(["last"]).mockResolvedValueOnce([]);
      feedbackThemeRepository.findScoreSignals.mockResolvedValue([]);

      expect(await service.rescoreAll(NOW)).toBe(RESCORE_BATCH_SIZE + 1);
      expect(feedbackThemeRepository.findRankableIds.mock.calls).toEqual([
        [null, RESCORE_BATCH_SIZE],
        [`theme-${RESCORE_BATCH_SIZE - 1}`, RESCORE_BATCH_SIZE],
        ["last", RESCORE_BATCH_SIZE]
      ]);
      expect(feedbackThemeRepository.findScoreSignals).toHaveBeenCalledWith(firstPage);
      expect(feedbackThemeRepository.findScoreSignals).toHaveBeenCalledWith(["last"]);
    });

    it("rescores nothing when there is no theme", async () => {
      const { service, feedbackThemeRepository } = setup();
      feedbackThemeRepository.findRankableIds.mockResolvedValue([]);

      expect(await service.rescoreAll(NOW)).toBe(0);
      expect(feedbackThemeRepository.findScoreSignals).not.toHaveBeenCalled();
    });
  });

  function setup(input: { weights?: string } = {}) {
    const feedbackThemeRepository = mock<FeedbackThemeRepository>();
    const config = envSchema.parse({ FEEDBACK_THEME_SCORE_WEIGHTS: input.weights });
    const service = new FeedbackThemeScoreService(feedbackThemeRepository, config);

    return { service, feedbackThemeRepository };
  }
});
