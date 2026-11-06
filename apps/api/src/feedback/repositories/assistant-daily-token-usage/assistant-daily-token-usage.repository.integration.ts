import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AssistantDailyTokenUsageRepository } from "./assistant-daily-token-usage.repository";

describe(AssistantDailyTokenUsageRepository.name, () => {
  describe("add", () => {
    it("adds the prompt and completion tokens of the day together", async () => {
      const { repository } = setup();

      await repository.add("2026-11-01", { promptTokens: 100, completionTokens: 20 });
      await repository.add("2026-11-01", { promptTokens: 50, completionTokens: 5 });

      expect(await repository.totalOn("2026-11-01")).toBe(175);
    });

    it("keeps each day apart", async () => {
      const { repository } = setup();

      await repository.add("2026-11-02", { promptTokens: 10, completionTokens: 1 });
      await repository.add("2026-11-03", { promptTokens: 20, completionTokens: 2 });

      expect(await repository.totalOn("2026-11-02")).toBe(11);
      expect(await repository.totalOn("2026-11-03")).toBe(22);
    });

    it("loses no tokens to concurrent turns", async () => {
      const { repository } = setup();

      await Promise.all(Array.from({ length: 5 }, () => repository.add("2026-11-04", { promptTokens: 10, completionTokens: 1 })));

      expect(await repository.totalOn("2026-11-04")).toBe(55);
    });
  });

  describe("totalOn", () => {
    it("answers zero for a day with no usage", async () => {
      const { repository } = setup();

      expect(await repository.totalOn("2020-01-01")).toBe(0);
    });
  });

  function setup() {
    return { repository: container.resolve(AssistantDailyTokenUsageRepository) };
  }
});
