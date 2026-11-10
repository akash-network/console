import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import type { AssistantDailyTokenUsageRepository } from "@src/feedback/repositories/assistant-daily-token-usage/assistant-daily-token-usage.repository";
import type { AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";
import { AssistantLimitsService } from "./assistant-limits.service";

const NOW = new Date("2026-11-04T23:59:00.000Z");

describe(AssistantLimitsService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("countMessage", () => {
    it("counts the message and lets it through at the limits", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue({ minuteMessageCount: 3, dayMessageCount: 50 });

      await expect(service.countMessage("user-1", false)).resolves.toBeUndefined();
      expect(userUsageRepository.countMessage).toHaveBeenCalledWith("user-1", NOW);
    });

    it("refuses more messages per minute than allowed", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue({ minuteMessageCount: 4, dayMessageCount: 1 });

      await expect(service.countMessage("user-1", false)).rejects.toMatchObject({ status: 429, errorCode: "assistant_rate_limited" });
    });

    it("refuses more messages per day than allowed, with a lower limit on trial", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue({ minuteMessageCount: 1, dayMessageCount: 11 });

      await expect(service.countMessage("user-1", true)).rejects.toMatchObject({ status: 429, errorCode: "assistant_daily_limit" });
      await expect(service.countMessage("user-1", null)).resolves.toBeUndefined();

      userUsageRepository.countMessage.mockResolvedValue({ minuteMessageCount: 1, dayMessageCount: 51 });
      await expect(service.countMessage("user-1", false)).rejects.toMatchObject({ status: 429, errorCode: "assistant_daily_limit" });
    });

    it("lets a trial user send up to the trial limit", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue({ minuteMessageCount: 1, dayMessageCount: 10 });

      await expect(service.countMessage("user-1", true)).resolves.toBeUndefined();
    });
  });

  describe("assertWithinBudget", () => {
    it("answers unavailable once today's tokens reach the budget", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository } = setup();
      tokenUsageRepository.totalOn.mockResolvedValue(999);

      await expect(service.assertWithinBudget()).resolves.toBeUndefined();
      expect(tokenUsageRepository.totalOn).toHaveBeenCalledWith("2026-11-04");

      tokenUsageRepository.totalOn.mockResolvedValue(1000);
      await expect(service.assertWithinBudget()).rejects.toMatchObject({ status: 503, errorCode: "assistant_unavailable" });
    });
  });

  describe("recordUsage", () => {
    it("adds a completion's tokens to today's total", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository } = setup();

      await service.recordUsage({ promptTokens: 10, completionTokens: 5 });

      expect(tokenUsageRepository.add).toHaveBeenCalledWith("2026-11-04", { promptTokens: 10, completionTokens: 5 });
    });

    it("records nothing when the model reported no usage", async () => {
      const { service, tokenUsageRepository } = setup();

      await service.recordUsage(null);

      expect(tokenUsageRepository.add).not.toHaveBeenCalled();
    });

    it("warns once when the day's tokens cross 80% of the budget", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository, logger } = setup();
      const usage = { promptTokens: 15, completionTokens: 5 };

      tokenUsageRepository.add.mockResolvedValueOnce(790);
      await service.recordUsage(usage);
      expect(logger.warn).not.toHaveBeenCalled();

      tokenUsageRepository.add.mockResolvedValueOnce(810);
      await service.recordUsage(usage);
      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TOKEN_BUDGET_WARNING", day: "2026-11-04", total: 810, budget: 1000 });

      tokenUsageRepository.add.mockResolvedValueOnce(850);
      await service.recordUsage(usage);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("warns when the day's tokens land exactly on 80% of the budget", async () => {
      const { service, tokenUsageRepository, logger } = setup();
      tokenUsageRepository.add.mockResolvedValue(800);

      await service.recordUsage({ promptTokens: 15, completionTokens: 5 });

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ASSISTANT_TOKEN_BUDGET_WARNING", total: 800 }));
    });

    it("does not warn again when the day's tokens were already at 80% of the budget", async () => {
      const { service, tokenUsageRepository, logger } = setup();
      tokenUsageRepository.add.mockResolvedValue(820);

      await service.recordUsage({ promptTokens: 15, completionTokens: 5 });

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const userUsageRepository = mock<AssistantUserUsageRepository>();
    const tokenUsageRepository = mock<AssistantDailyTokenUsageRepository>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = envSchema.parse({
      ASSISTANT_MESSAGES_PER_MINUTE: "3",
      ASSISTANT_MESSAGES_PER_DAY: "50",
      ASSISTANT_TRIAL_MESSAGES_PER_DAY: "10",
      ASSISTANT_DAILY_TOKEN_BUDGET: "1000"
    });
    const service = new AssistantLimitsService(userUsageRepository, tokenUsageRepository, config, createLogger);

    return { service, userUsageRepository, tokenUsageRepository, logger };
  }
});
