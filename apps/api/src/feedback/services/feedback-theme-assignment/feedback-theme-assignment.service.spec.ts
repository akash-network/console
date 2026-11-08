import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/feedback/config/env.config";
import { buildThemeMatchMessages, type ItemToMatch, THEME_MATCH_SCHEMA } from "@src/feedback/lib/feedback-theme-match-prompt/feedback-theme-match-prompt";
import type { FeedbackThemeOutput, FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import type { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import { FeedbackThemeAssignmentService, MAX_THEME_CANDIDATES } from "./feedback-theme-assignment.service";

const ITEM: ItemToMatch = { type: "bug", summary: "Logs page stays empty" };

describe(FeedbackThemeAssignmentService.name, () => {
  describe("findMatch", () => {
    it("asks the model to pick among the open themes of the item's type", async () => {
      const candidates = [theme({ id: "theme-a", title: "Empty logs" }), theme({ id: "theme-b", title: "Shell drops" })];
      const { service, feedbackThemeRepository, akashMlClient } = setup({ candidates });
      akashMlClient.completeJson.mockResolvedValue({ themeKey: "T1", title: null, summary: null });

      const match = await service.findMatch(ITEM);

      expect(match).toEqual({ themeId: "theme-a" });
      expect(feedbackThemeRepository.findMatchCandidates).toHaveBeenCalledWith("bug", MAX_THEME_CANDIDATES);
      expect(akashMlClient.completeJson).toHaveBeenCalledWith({
        model: "classifier-model",
        messages: buildThemeMatchMessages(ITEM, candidates),
        schema: THEME_MATCH_SCHEMA,
        temperature: 0
      });
    });

    it("answers the new theme the model proposed", async () => {
      const { service, akashMlClient } = setup({ candidates: [theme()] });
      akashMlClient.completeJson.mockResolvedValue({ themeKey: null, title: "Logs missing", summary: "The logs page shows nothing" });

      expect(await service.findMatch(ITEM)).toEqual({ title: "Logs missing", summary: "The logs page shows nothing" });
    });

    it("starts a theme from the item without asking the model when there is nothing to compare against", async () => {
      const { service, akashMlClient } = setup({ candidates: [] });

      expect(await service.findMatch(ITEM)).toEqual({ title: ITEM.summary, summary: ITEM.summary });
      expect(akashMlClient.completeJson).not.toHaveBeenCalled();
    });
  });

  describe("nameNewTheme", () => {
    it("asks the model to name a theme for the item with no existing theme to join", async () => {
      const { service, akashMlClient } = setup();
      akashMlClient.completeJson.mockResolvedValue({ themeKey: null, title: "Logs missing", summary: "The logs page shows nothing" });

      expect(await service.nameNewTheme(ITEM)).toEqual({ title: "Logs missing", summary: "The logs page shows nothing" });
      expect(akashMlClient.completeJson).toHaveBeenCalledWith({
        model: "classifier-model",
        messages: buildThemeMatchMessages(ITEM, []),
        schema: THEME_MATCH_SCHEMA,
        temperature: 0
      });
    });

    it("names the theme after the item when the model proposes no title", async () => {
      const { service, akashMlClient } = setup();
      akashMlClient.completeJson.mockResolvedValue({ themeKey: null, title: null, summary: null });

      expect(await service.nameNewTheme(ITEM)).toEqual({ title: ITEM.summary, summary: ITEM.summary });
    });
  });

  describe("themeIdFor", () => {
    it("answers the theme a matched one now resolves to", async () => {
      const { service, feedbackThemeRepository } = setup();
      feedbackThemeRepository.resolveActiveId.mockResolvedValue("merged-target");

      expect(await service.themeIdFor({ themeId: "theme-a" }, ITEM)).toBe("merged-target");
      expect(feedbackThemeRepository.resolveActiveId).toHaveBeenCalledWith("theme-a");
      expect(feedbackThemeRepository.create).not.toHaveBeenCalled();
    });

    it("creates the proposed theme with the item's type", async () => {
      const { service, feedbackThemeRepository } = setup();
      feedbackThemeRepository.create.mockResolvedValue(theme({ id: "created" }));

      expect(await service.themeIdFor({ title: "Logs missing", summary: "Nothing shows" }, ITEM)).toBe("created");
      expect(feedbackThemeRepository.create).toHaveBeenCalledWith({ title: "Logs missing", summary: "Nothing shows", type: "bug" });
      expect(feedbackThemeRepository.resolveActiveId).not.toHaveBeenCalled();
    });

    it("starts a theme from the item when the matched one leads nowhere", async () => {
      const { service, feedbackThemeRepository } = setup();
      feedbackThemeRepository.resolveActiveId.mockResolvedValue(null);
      feedbackThemeRepository.create.mockResolvedValue(theme({ id: "created" }));

      expect(await service.themeIdFor({ themeId: "gone" }, ITEM)).toBe("created");
      expect(feedbackThemeRepository.create).toHaveBeenCalledWith({ title: ITEM.summary, summary: ITEM.summary, type: "bug" });
    });
  });

  function theme(overrides: Partial<FeedbackThemeOutput> = {}): FeedbackThemeOutput {
    return mock<FeedbackThemeOutput>({ id: "theme-id", title: "A theme", summary: null, ...overrides });
  }

  function setup(input: { candidates?: FeedbackThemeOutput[] } = {}) {
    const feedbackThemeRepository = mock<FeedbackThemeRepository>();
    feedbackThemeRepository.findMatchCandidates.mockResolvedValue(input.candidates ?? []);
    const akashMlClient = mock<AkashMlClient>();
    const config = envSchema.parse({ FEEDBACK_CLASSIFIER_MODEL: "classifier-model" });
    const service = new FeedbackThemeAssignmentService(feedbackThemeRepository, akashMlClient, config);

    return { service, feedbackThemeRepository, akashMlClient };
  }
});
