import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { FeedbackThemeRepository } from "./feedback-theme.repository";

import { seedAssistantConversation, seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(FeedbackThemeRepository.name, () => {
  describe("refreshCounts", () => {
    it("counts the submissions and conversations attached to a theme, the distinct users behind them and when they were seen", async () => {
      const { repository } = setup();
      const [alice, bob] = await Promise.all([seedUser(), seedUser()]);
      const theme = await seedFeedbackTheme({ itemCount: 99, distinctUserCount: 99 });
      await seedFeedbackSubmission({ userId: alice.id, themeId: theme.id, createdAt: new Date("2026-10-01T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId: alice.id, themeId: theme.id, createdAt: new Date("2026-10-03T00:00:00.000Z") });
      await seedAssistantConversation({ userId: bob.id, themeId: theme.id, startedAt: new Date("2026-10-05T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId: bob.id });

      await repository.refreshCounts([theme.id, theme.id]);

      expect(await repository.findById(theme.id)).toMatchObject({
        itemCount: 3,
        distinctUserCount: 2,
        firstSeenAt: new Date("2026-10-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-10-05T00:00:00.000Z")
      });
    });

    it("empties a theme whose items are all gone", async () => {
      const { repository } = setup();
      const theme = await seedFeedbackTheme({ itemCount: 4, distinctUserCount: 2, firstSeenAt: new Date(), lastSeenAt: new Date() });

      await repository.refreshCounts([theme.id]);

      expect(await repository.findById(theme.id)).toMatchObject({ itemCount: 0, distinctUserCount: 0, firstSeenAt: null, lastSeenAt: null });
    });

    it("leaves the themes it was not asked about", async () => {
      const { repository } = setup();
      const [asked, untouched] = await Promise.all([seedFeedbackTheme({ itemCount: 5 }), seedFeedbackTheme({ itemCount: 5 })]);

      await repository.refreshCounts([asked.id]);

      expect(await repository.findById(asked.id)).toMatchObject({ itemCount: 0 });
      expect(await repository.findById(untouched.id)).toMatchObject({ itemCount: 5, updatedAt: untouched.updatedAt });
    });

    it("does nothing without themes", async () => {
      const { repository } = setup();

      await expect(repository.refreshCounts([])).resolves.toBeUndefined();
    });
  });

  function setup() {
    return { repository: container.resolve(FeedbackThemeRepository) };
  }
});
