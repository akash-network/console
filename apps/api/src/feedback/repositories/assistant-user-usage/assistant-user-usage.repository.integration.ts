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

  describe("addTokens", () => {
    it("adds tokens only to the row of the day they were used", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.addTokens(userId, "2026-11-04", 40);

      await repository.addTokens(userId, "2026-11-03", 50);

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:30.000Z"))).toMatchObject({ dayTokenCount: 40 });
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
