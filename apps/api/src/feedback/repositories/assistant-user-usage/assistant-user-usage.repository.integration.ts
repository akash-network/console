import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AssistantUserUsageRepository } from "./assistant-user-usage.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AssistantUserUsageRepository.name, () => {
  describe("countMessage", () => {
    it("counts the messages of the same minute and day", async () => {
      const { repository, userId } = await setup();

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"))).toEqual({
        dayMessageCount: 1,
        minuteMessageCount: 1,
        dayTokenCount: 0
      });
      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:59.000Z"))).toEqual({
        dayMessageCount: 2,
        minuteMessageCount: 2,
        dayTokenCount: 0
      });
    });

    it("starts a new minute window once a minute has passed since the window started, keeping the day count", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.countMessage(userId, new Date("2026-11-04T12:00:30.000Z"));

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:01:00.000Z"))).toEqual({
        dayMessageCount: 3,
        minuteMessageCount: 1,
        dayTokenCount: 0
      });
      expect(await repository.countMessage(userId, new Date("2026-11-04T12:01:30.000Z"))).toEqual({
        dayMessageCount: 4,
        minuteMessageCount: 2,
        dayTokenCount: 0
      });
    });

    it("starts the day count over on a new UTC day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T23:58:00.000Z"));

      expect(await repository.countMessage(userId, new Date("2026-11-05T00:00:00.000Z"))).toEqual({
        dayMessageCount: 1,
        minuteMessageCount: 1,
        dayTokenCount: 0
      });
    });

    it("counts each user apart", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 300);

      expect(await repository.countMessage(other.id, new Date("2026-11-04T12:00:00.000Z"))).toEqual({
        dayMessageCount: 1,
        minuteMessageCount: 1,
        dayTokenCount: 0
      });
    });

    it("never hands two concurrent messages the same count", async () => {
      const { repository, userId } = await setup();
      const sentAt = new Date("2026-11-04T12:00:00.000Z");

      const counts = await Promise.all(Array.from({ length: 5 }, () => repository.countMessage(userId, sentAt)));

      expect(counts.map(count => count.minuteMessageCount).sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it("returns the tokens used today with the message counts", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 120);
      await repository.addTokens(userId, "2026-11-04", 30);

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:30.000Z"))).toEqual({
        dayMessageCount: 2,
        minuteMessageCount: 2,
        dayTokenCount: 150
      });
    });

    it("starts the token count at zero on a new day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-03T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-03", 900);

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"))).toEqual({
        dayMessageCount: 1,
        minuteMessageCount: 1,
        dayTokenCount: 0
      });
    });
  });

  describe("countProblemReport", () => {
    it("counts the reports of the same day for a user who never sent a message", async () => {
      const { repository, userId } = await setup();

      expect(await repository.countProblemReport(userId, new Date("2026-11-04T12:00:00.000Z"))).toBe(1);
      expect(await repository.countProblemReport(userId, new Date("2026-11-04T23:59:00.000Z"))).toBe(2);
    });

    it("leaves today's message and token counts alone", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 120);

      await repository.countProblemReport(userId, new Date("2026-11-04T12:00:10.000Z"));

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:20.000Z"))).toEqual({
        dayMessageCount: 2,
        minuteMessageCount: 2,
        dayTokenCount: 120
      });
    });

    it("starts every day count over on a new UTC day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T23:58:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 900);
      await repository.countProblemReport(userId, new Date("2026-11-04T23:59:00.000Z"));

      expect(await repository.countProblemReport(userId, new Date("2026-11-05T00:00:00.000Z"))).toBe(1);
      expect(await repository.countMessage(userId, new Date("2026-11-05T00:01:00.000Z"))).toMatchObject({ dayMessageCount: 1, dayTokenCount: 0 });
    });

    it("is started over by the first message of a new day", async () => {
      const { repository, userId } = await setup();
      await repository.countProblemReport(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.countMessage(userId, new Date("2026-11-05T12:00:00.000Z"));

      expect(await repository.countProblemReport(userId, new Date("2026-11-05T12:00:10.000Z"))).toBe(1);
    });

    it("keeps the count when a message of the same day follows", async () => {
      const { repository, userId } = await setup();
      await repository.countProblemReport(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.countMessage(userId, new Date("2026-11-04T12:00:10.000Z"));

      expect(await repository.countProblemReport(userId, new Date("2026-11-04T12:00:20.000Z"))).toBe(2);
    });

    it("never hands two concurrent reports the same count", async () => {
      const { repository, userId } = await setup();
      const sentAt = new Date("2026-11-04T12:00:00.000Z");

      const counts = await Promise.all(Array.from({ length: 5 }, () => repository.countProblemReport(userId, sentAt)));

      expect(counts.sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("addTokens", () => {
    it("adds tokens only to the row of the day they were used", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 40);

      await repository.addTokens(userId, "2026-11-03", 50);

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:30.000Z"))).toMatchObject({ dayTokenCount: 40 });
    });
  });

  describe("countFlaggedTurn", () => {
    it("counts the flagged turns of the day the messages were sent on", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));

      expect(await repository.countFlaggedTurn(userId, "2026-11-04")).toBe(1);
      expect(await repository.countFlaggedTurn(userId, "2026-11-04")).toBe(2);
    });

    it("counts nothing for a day the user has no row for", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-03T12:00:00.000Z"));

      expect(await repository.countFlaggedTurn(userId, "2026-11-04")).toBe(0);
      expect(await repository.countFlaggedTurn((await seedUser()).id, "2026-11-04")).toBe(0);
    });

    it("starts the flagged turn count over when a problem report opens a new UTC day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T23:59:00.000Z"));
      await repository.countFlaggedTurn(userId, "2026-11-04");
      await repository.countFlaggedTurn(userId, "2026-11-04");
      await repository.countProblemReport(userId, new Date("2026-11-05T00:00:00.000Z"));
      await repository.countMessage(userId, new Date("2026-11-05T00:01:00.000Z"));

      expect(await repository.countFlaggedTurn(userId, "2026-11-05")).toBe(1);
    });

    it("keeps the flagged turn count when a problem report of the same day follows", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.countFlaggedTurn(userId, "2026-11-04");
      await repository.countProblemReport(userId, new Date("2026-11-04T12:00:10.000Z"));

      expect(await repository.countFlaggedTurn(userId, "2026-11-04")).toBe(2);
    });

    it("starts the flagged turn count over on a new UTC day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T23:59:00.000Z"));
      await repository.countFlaggedTurn(userId, "2026-11-04");
      await repository.countFlaggedTurn(userId, "2026-11-04");
      await repository.countMessage(userId, new Date("2026-11-04T23:59:30.000Z"));

      expect(await repository.countFlaggedTurn(userId, "2026-11-04")).toBe(3);

      await repository.countMessage(userId, new Date("2026-11-05T00:00:00.000Z"));

      expect(await repository.countFlaggedTurn(userId, "2026-11-05")).toBe(1);
    });

    it("never hands two concurrent flagged turns the same count", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));

      const counts = await Promise.all(Array.from({ length: 5 }, () => repository.countFlaggedTurn(userId, "2026-11-04")));

      expect(counts.sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("dayTokenCountOf", () => {
    it("returns the tokens the user used on the given day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 120);
      await repository.addTokens(userId, "2026-11-04", 30);

      expect(await repository.dayTokenCountOf(userId, "2026-11-04")).toBe(150);
    });

    it("returns zero for a day the user has no count for", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-03T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-03", 900);

      expect(await repository.dayTokenCountOf(userId, "2026-11-04")).toBe(0);
    });

    it("returns zero for a user who never sent a message", async () => {
      const { repository, userId } = await setup();

      expect(await repository.dayTokenCountOf(userId, "2026-11-04")).toBe(0);
    });

    it("counts each user apart", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 300);
      await repository.countMessage(other.id, new Date("2026-11-04T12:00:00.000Z"));

      expect(await repository.dayTokenCountOf(other.id, "2026-11-04")).toBe(0);
    });
  });

  async function setup() {
    const user = await seedUser();

    return { repository: container.resolve(AssistantUserUsageRepository), userId: user.id };
  }
});
