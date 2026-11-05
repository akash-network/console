import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { resolveTable } from "@src/core";
import { POSTGRES_DB } from "@src/core/providers";
import { AssistantConversationDailyCountRepository } from "./assistant-conversation-daily-count.repository";

describe(AssistantConversationDailyCountRepository.name, () => {
  describe("countEnded", () => {
    it("counts resolved and unresolved conversations of the day apart", async () => {
      const { repository, countsOn } = setup();

      await repository.countEnded("2026-11-01", true);
      await repository.countEnded("2026-11-01", false);
      await repository.countEnded("2026-11-01", false);
      await repository.countEnded("2026-11-02", true);

      expect(await countsOn("2026-11-01")).toEqual({ resolvedCount: 1, unresolvedCount: 2 });
      expect(await countsOn("2026-11-02")).toEqual({ resolvedCount: 1, unresolvedCount: 0 });
    });

    it("loses no count to conversations ending at once", async () => {
      const { repository, countsOn } = setup();

      await Promise.all(Array.from({ length: 5 }, (_, index) => repository.countEnded("2026-11-03", index % 2 === 0)));

      expect(await countsOn("2026-11-03")).toEqual({ resolvedCount: 3, unresolvedCount: 2 });
    });
  });

  function setup() {
    const table = resolveTable("AssistantConversationDailyCounts");
    const db = container.resolve(POSTGRES_DB);
    const countsOn = async (day: string) =>
      (await db.select({ resolvedCount: table.resolvedCount, unresolvedCount: table.unresolvedCount }).from(table).where(eq(table.day, day)))[0];

    return { repository: container.resolve(AssistantConversationDailyCountRepository), countsOn };
  }
});
