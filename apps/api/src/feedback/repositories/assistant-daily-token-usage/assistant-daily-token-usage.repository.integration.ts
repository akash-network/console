import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AssistantDailyTokenUsageRepository } from "./assistant-daily-token-usage.repository";

const PAID = { isTrial: false };
const TRIAL = { isTrial: true };

describe(AssistantDailyTokenUsageRepository.name, () => {
  describe("add", () => {
    it("adds the prompt and completion tokens of the day together", async () => {
      const { repository } = setup();

      await repository.add("2026-11-01", { promptTokens: 100, completionTokens: 20 }, PAID);
      await repository.add("2026-11-01", { promptTokens: 50, completionTokens: 5 }, PAID);

      expect(await repository.totalsOn("2026-11-01")).toEqual({ total: 175, trialTotal: 0 });
    });

    it("adds the tokens of trial turns to the trial total as well", async () => {
      const { repository } = setup();

      await repository.add("2026-11-06", { promptTokens: 100, completionTokens: 20 }, TRIAL);
      await repository.add("2026-11-06", { promptTokens: 50, completionTokens: 5 }, PAID);
      await repository.add("2026-11-06", { promptTokens: 7, completionTokens: 3 }, TRIAL);

      expect(await repository.totalsOn("2026-11-06")).toEqual({ total: 185, trialTotal: 130 });
    });

    it("keeps each day apart", async () => {
      const { repository } = setup();

      await repository.add("2026-11-02", { promptTokens: 10, completionTokens: 1 }, TRIAL);
      await repository.add("2026-11-03", { promptTokens: 20, completionTokens: 2 }, TRIAL);

      expect(await repository.totalsOn("2026-11-02")).toEqual({ total: 11, trialTotal: 11 });
      expect(await repository.totalsOn("2026-11-03")).toEqual({ total: 22, trialTotal: 22 });
    });

    it("loses no tokens to concurrent turns", async () => {
      const { repository } = setup();

      await Promise.all(Array.from({ length: 5 }, () => repository.add("2026-11-04", { promptTokens: 10, completionTokens: 1 }, TRIAL)));

      expect(await repository.totalsOn("2026-11-04")).toEqual({ total: 55, trialTotal: 55 });
    });

    it("returns the day's new totals", async () => {
      const { repository } = setup();

      expect(await repository.add("2026-11-05", { promptTokens: 100, completionTokens: 20 }, TRIAL)).toEqual({ total: 120, trialTotal: 120 });
      expect(await repository.add("2026-11-05", { promptTokens: 50, completionTokens: 5 }, PAID)).toEqual({ total: 175, trialTotal: 120 });
    });
  });

  describe("totalsOn", () => {
    it("answers zero for a day with no usage", async () => {
      const { repository } = setup();

      expect(await repository.totalsOn("2020-01-01")).toEqual({ total: 0, trialTotal: 0 });
    });
  });

  function setup() {
    return { repository: container.resolve(AssistantDailyTokenUsageRepository) };
  }
});
