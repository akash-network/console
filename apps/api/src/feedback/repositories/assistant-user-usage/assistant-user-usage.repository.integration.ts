import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AssistantUserUsageRepository } from "./assistant-user-usage.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AssistantUserUsageRepository.name, () => {
  describe("countMessage", () => {
    it("counts the messages of the same minute and day", async () => {
      const { repository, userId } = await setup();

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"))).toEqual({ dayMessageCount: 1, minuteMessageCount: 1 });
      expect(await repository.countMessage(userId, new Date("2026-11-04T12:00:59.000Z"))).toEqual({ dayMessageCount: 2, minuteMessageCount: 2 });
    });

    it("starts a new minute window once a minute has passed since the window started, keeping the day count", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));
      await repository.countMessage(userId, new Date("2026-11-04T12:00:30.000Z"));

      expect(await repository.countMessage(userId, new Date("2026-11-04T12:01:00.000Z"))).toEqual({ dayMessageCount: 3, minuteMessageCount: 1 });
      expect(await repository.countMessage(userId, new Date("2026-11-04T12:01:30.000Z"))).toEqual({ dayMessageCount: 4, minuteMessageCount: 2 });
    });

    it("starts the day count over on a new UTC day", async () => {
      const { repository, userId } = await setup();
      await repository.countMessage(userId, new Date("2026-11-04T23:58:00.000Z"));

      expect(await repository.countMessage(userId, new Date("2026-11-05T00:00:00.000Z"))).toEqual({ dayMessageCount: 1, minuteMessageCount: 1 });
    });

    it("counts each user apart", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      await repository.countMessage(userId, new Date("2026-11-04T12:00:00.000Z"));

      expect(await repository.countMessage(other.id, new Date("2026-11-04T12:00:00.000Z"))).toEqual({ dayMessageCount: 1, minuteMessageCount: 1 });
    });

    it("never hands two concurrent messages the same count", async () => {
      const { repository, userId } = await setup();
      const sentAt = new Date("2026-11-04T12:00:00.000Z");

      const counts = await Promise.all(Array.from({ length: 5 }, () => repository.countMessage(userId, sentAt)));

      expect(counts.map(count => count.minuteMessageCount).sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  async function setup() {
    const user = await seedUser();

    return { repository: container.resolve(AssistantUserUsageRepository), userId: user.id };
  }
});
