import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { FeedbackSubmissionRepository } from "./feedback-submission.repository";

import { seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(FeedbackSubmissionRepository.name, () => {
  describe("createUnlessAnswered", () => {
    it("stores the first answer for a deployment and nothing for a second one", async () => {
      const { repository, userId } = await setup();
      const answer = { userId, kind: "deployment_outcome" as const, dseq: "123", outcome: "live" as const, rating: 5, context: { isTrialing: false } };

      const first = await repository.createUnlessAnswered(answer);
      const second = await repository.createUnlessAnswered({ ...answer, rating: 1 });

      expect(first).toMatchObject({ userId, dseq: "123", rating: 5 });
      expect(second).toBeUndefined();
      expect(await repository.count({ userId })).toBe(1);
    });

    it("lets another user answer for the same deployment and the same user send general feedback freely", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      const answer = { kind: "deployment_outcome" as const, dseq: "123", outcome: "failed" as const, dismissed: true, context: { isTrialing: null } };
      const general = { userId, kind: "general" as const, category: "bug" as const, message: "broken", context: { isTrialing: null } };

      await repository.createUnlessAnswered({ ...answer, userId });

      expect(await repository.createUnlessAnswered({ ...answer, userId: other.id })).toBeDefined();
      expect(await repository.createUnlessAnswered(general)).toBeDefined();
      expect(await repository.createUnlessAnswered(general)).toBeDefined();
    });
  });

  describe("countSince", () => {
    it("counts the user's submissions sent after the given time", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      await seedFeedbackSubmission({ userId, createdAt: new Date("2026-11-01T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId, createdAt: new Date("2026-11-03T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId, createdAt: new Date("2026-11-04T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId: other.id, createdAt: new Date("2026-11-04T00:00:00.000Z") });

      expect(await repository.countSince(userId, new Date("2026-11-03T00:00:00.000Z"))).toBe(1);
    });
  });

  describe("findLatestOutcomeAnswerAt", () => {
    it("answers when the user last answered an outcome prompt, ignoring general feedback and other users", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      await seedFeedbackSubmission({ userId, createdAt: new Date("2026-10-01T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId, dismissed: true, rating: null, createdAt: new Date("2026-10-02T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId, kind: "general", dseq: null, category: "bug", createdAt: new Date("2026-10-09T00:00:00.000Z") });
      await seedFeedbackSubmission({ userId: other.id, createdAt: new Date("2026-10-10T00:00:00.000Z") });

      expect(await repository.findLatestOutcomeAnswerAt(userId)).toEqual(new Date("2026-10-02T00:00:00.000Z"));
    });

    it("answers null for a user who never answered one", async () => {
      const { repository, userId } = await setup();

      expect(await repository.findLatestOutcomeAnswerAt(userId)).toBeNull();
    });
  });

  describe("deleteAllOf", () => {
    it("deletes only the user's submissions and answers the themes they belonged to", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      const theme = await seedFeedbackTheme();
      await seedFeedbackSubmission({ userId, themeId: theme.id });
      await seedFeedbackSubmission({ userId });
      await seedFeedbackSubmission({ userId: other.id, themeId: theme.id });

      expect(await repository.deleteAllOf(userId)).toEqual([theme.id]);
      expect(await repository.count({ userId })).toBe(0);
      expect(await repository.count({ userId: other.id })).toBe(1);
    });
  });

  describe("findUnclassifiedIds", () => {
    it("answers the oldest submissions still waiting for classification, leaving dismissed and classified ones out", async () => {
      const { repository, userId } = await setup();
      const older = await seedFeedbackSubmission({ userId, createdAt: new Date("2020-01-01T00:00:00.000Z") });
      const newer = await seedFeedbackSubmission({ userId, createdAt: new Date("2020-01-02T00:00:00.000Z") });
      const dismissed = await seedFeedbackSubmission({ userId, dismissed: true, createdAt: new Date("2020-01-01T00:00:00.000Z") });
      const classified = await seedFeedbackSubmission({ userId, classifiedAt: new Date(), createdAt: new Date("2020-01-01T00:00:00.000Z") });

      const ids = await repository.findUnclassifiedIds(1000);

      expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
      expect(ids).toContain(older.id);
      expect(ids).not.toContain(dismissed.id);
      expect(ids).not.toContain(classified.id);
    });

    it("answers at most the given number of submissions", async () => {
      const { repository, userId } = await setup();
      await seedFeedbackSubmission({ userId });
      await seedFeedbackSubmission({ userId });

      expect(await repository.findUnclassifiedIds(1)).toHaveLength(1);
    });
  });

  async function setup() {
    const user = await seedUser();

    return { repository: container.resolve(FeedbackSubmissionRepository), userId: user.id };
  }
});
