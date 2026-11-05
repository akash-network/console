import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { FeedbackThemeRepository } from "./feedback-theme.repository";

import { seedAssistantConversation, seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

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

  describe("findMatchCandidates", () => {
    it("answers the unmerged themes of the type, most recently seen first", async () => {
      const { repository } = setup();
      const type = "feature_request";
      const stale = await seedFeedbackTheme({ type, lastSeenAt: new Date("2026-01-01T00:00:00.000Z") });
      const fresh = await seedFeedbackTheme({ type, status: "linked", lastSeenAt: new Date("2026-10-01T00:00:00.000Z") });
      const unseen = await seedFeedbackTheme({ type, status: "wont_do" });
      const merged = await seedFeedbackTheme({ type, status: "merged" });
      const otherType = await seedFeedbackTheme({ type: "bug", lastSeenAt: new Date() });

      const ids = (await repository.findMatchCandidates(type, 100)).map(({ id }) => id);

      expect(ids.indexOf(fresh.id)).toBeLessThan(ids.indexOf(stale.id));
      expect(ids.indexOf(stale.id)).toBeLessThan(ids.indexOf(unseen.id));
      expect(ids.indexOf(fresh.id)).toBeGreaterThanOrEqual(0);
      expect(ids).not.toContain(merged.id);
      expect(ids).not.toContain(otherType.id);
    });

    it("answers at most the given number of themes", async () => {
      const { repository } = setup();
      await seedFeedbackTheme({ type: "support_question" });
      await seedFeedbackTheme({ type: "support_question" });

      expect(await repository.findMatchCandidates("support_question", 1)).toHaveLength(1);
    });
  });

  describe("resolveActiveId", () => {
    it("answers an unmerged theme itself", async () => {
      const { repository } = setup();
      const theme = await seedFeedbackTheme({ status: "linked" });

      expect(await repository.resolveActiveId(theme.id)).toBe(theme.id);
    });

    it("follows a chain of merges to the theme that took them in", async () => {
      const { repository } = setup();
      const target = await seedFeedbackTheme();
      const middle = await seedFeedbackTheme({ status: "merged", mergedIntoId: target.id });
      const merged = await seedFeedbackTheme({ status: "merged", mergedIntoId: middle.id });

      expect(await repository.resolveActiveId(merged.id)).toBe(target.id);
    });

    it("answers null for a merged theme that leads nowhere or a theme that is gone", async () => {
      const { repository } = setup();
      const orphan = await seedFeedbackTheme({ status: "merged", mergedIntoId: null });
      const first = await seedFeedbackTheme({ status: "merged" });
      const second = await seedFeedbackTheme({ status: "merged", mergedIntoId: first.id });
      await repository.updateById(first.id, { mergedIntoId: second.id });

      expect(await repository.resolveActiveId(orphan.id)).toBeNull();
      expect(await repository.resolveActiveId(first.id)).toBeNull();
      expect(await repository.resolveActiveId("00000000-0000-0000-0000-000000000000")).toBeNull();
    });
  });

  describe("findRankableIds", () => {
    it("pages through the unmerged themes by id", async () => {
      const { repository } = setup();
      const merged = await seedFeedbackTheme({ status: "merged" });
      await seedFeedbackTheme();
      await seedFeedbackTheme();

      const firstPage = await repository.findRankableIds(null, 1);
      const nextPage = await repository.findRankableIds(firstPage[0], 1000);
      const all = [...firstPage, ...nextPage];

      expect(firstPage).toHaveLength(1);
      expect(all).toEqual([...all].sort());
      expect(new Set(all).size).toBe(all.length);
      expect(all).not.toContain(merged.id);
    });
  });

  describe("updateScore", () => {
    it("sets the score of that theme only", async () => {
      const { repository } = setup();
      const [scored, untouched] = await Promise.all([seedFeedbackTheme(), seedFeedbackTheme()]);

      await repository.updateScore(scored.id, 4.25);

      expect(await repository.findById(scored.id)).toMatchObject({ score: 4.25 });
      expect(await repository.findById(untouched.id)).toMatchObject({ score: 0 });
    });
  });

  describe("findScoreSignals", () => {
    it("answers the signals of every submission and conversation attached to the themes", async () => {
      const { repository } = setup();
      const now = new Date();
      const { user: payingUser } = await seedUserWithWallet({ isTrialing: false, user: { createdAt: new Date("2019-01-01T00:00:00.000Z") } });
      const { user: trialUser } = await seedUserWithWallet({ isTrialing: true });
      const theme = await seedFeedbackTheme();
      const otherTheme = await seedFeedbackTheme();
      const submittedAt = new Date("2020-01-01T00:00:00.000Z");
      await seedFeedbackSubmission({
        userId: payingUser.id,
        themeId: theme.id,
        outcome: "failed",
        rating: 1,
        sentimentScore: -0.8,
        endedStuck: true,
        createdAt: submittedAt
      });
      await seedAssistantConversation({ userId: trialUser.id, themeId: theme.id, sentimentScore: 0.2, endedStuck: false, startedAt: now });
      await seedFeedbackSubmission({ userId: trialUser.id, themeId: otherTheme.id, outcome: "live", createdAt: now });

      const signals = await repository.findScoreSignals([theme.id]);

      expect(signals).toHaveLength(2);
      expect(signals).toContainEqual({
        themeId: theme.id,
        userId: payingUser.id,
        seenAt: submittedAt,
        rating: 1,
        sentimentScore: -0.8,
        endedStuck: true,
        deploymentFailed: true,
        isPayingUser: true,
        isFirstWeekUser: false
      });
      expect(signals).toContainEqual({
        themeId: theme.id,
        userId: trialUser.id,
        seenAt: now,
        rating: null,
        sentimentScore: 0.2,
        endedStuck: false,
        deploymentFailed: false,
        isPayingUser: false,
        isFirstWeekUser: true
      });
    });

    it("counts a user as paying through the organization wallet the item was filed under", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const organization = await seedOrganization();
      await seedOrganizationWallet({ organizationId: organization.id, isTrialing: false });
      const theme = await seedFeedbackTheme();
      await seedFeedbackSubmission({ userId: user.id, organizationId: organization.id, themeId: theme.id, outcome: null });

      const [signal] = await repository.findScoreSignals([theme.id]);

      expect(signal).toMatchObject({ isPayingUser: true, deploymentFailed: false });
    });

    it("does not count a user without a wallet as paying", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const theme = await seedFeedbackTheme();
      await seedFeedbackSubmission({ userId: user.id, themeId: theme.id });

      const [signal] = await repository.findScoreSignals([theme.id]);

      expect(signal).toMatchObject({ isPayingUser: false });
    });

    it("answers nothing without themes", async () => {
      const { repository } = setup();

      expect(await repository.findScoreSignals([])).toEqual([]);
    });
  });

  function setup() {
    return { repository: container.resolve(FeedbackThemeRepository) };
  }
});
