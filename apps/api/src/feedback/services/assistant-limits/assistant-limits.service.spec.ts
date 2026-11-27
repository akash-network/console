import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import { ASSISTANT_ERROR_CODES } from "@src/feedback/lib/assistant-errors/assistant-errors";
import type { AssistantDailyTokenUsageRepository } from "@src/feedback/repositories/assistant-daily-token-usage/assistant-daily-token-usage.repository";
import type { AssistantMessageCounts, AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";
import { AssistantLimitsService } from "./assistant-limits.service";

const NOW = new Date("2026-11-04T23:59:00.000Z");

function counts(overrides: Partial<AssistantMessageCounts>): AssistantMessageCounts {
  return { minuteMessageCount: 1, dayMessageCount: 1, dayTokenCount: 0, totalMessageCount: 1, ...overrides };
}

describe(AssistantLimitsService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("countMessage", () => {
    it("counts the message and lets it through at the limits", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ minuteMessageCount: 3, dayMessageCount: 50, totalMessageCount: 5000 }));

      await expect(service.countMessage("user-1", false)).resolves.toBeUndefined();
      expect(userUsageRepository.countMessage).toHaveBeenCalledWith("user-1", NOW);
    });

    it("refuses more messages per minute than allowed", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ minuteMessageCount: 4, totalMessageCount: 21 }));

      await expect(service.countMessage("user-1", true)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.rateLimited });
    });

    it("refuses more messages per day than allowed, with a lower limit on trial and without a wallet", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ dayMessageCount: 11 }));

      await expect(service.countMessage("user-1", true)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
      await expect(service.countMessage("user-1", null)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
      await expect(service.countMessage("user-1", false)).resolves.toBeUndefined();

      userUsageRepository.countMessage.mockResolvedValue(counts({ dayMessageCount: 51 }));
      await expect(service.countMessage("user-1", false)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
    });

    it("lets a trial user send up to the trial limits", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ dayMessageCount: 10, totalMessageCount: 20 }));

      await expect(service.countMessage("user-1", true)).resolves.toBeUndefined();
      await expect(service.countMessage("user-1", null)).resolves.toBeUndefined();
    });

    it("refuses a trial user or a user without a wallet past the total trial messages, asking them to add credits", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ dayMessageCount: 1, totalMessageCount: 21 }));

      for (const isTrialing of [true, null]) {
        await expect(service.countMessage("user-1", isTrialing)).rejects.toMatchObject({
          status: 429,
          errorCode: ASSISTANT_ERROR_CODES.trialLimit,
          message: "You used all your free Sidekick messages. Add credits to keep using Sidekick."
        });
      }
      await expect(service.countMessage("user-1", false)).resolves.toBeUndefined();
    });

    it("refuses a user who used their daily tokens with the daily limit error", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ dayTokenCount: 1_999_999 }));
      await expect(service.countMessage("user-1", false)).resolves.toBeUndefined();

      userUsageRepository.countMessage.mockResolvedValue(counts({ dayTokenCount: 2_000_000 }));
      await expect(service.countMessage("user-1", false)).rejects.toMatchObject({
        status: 429,
        errorCode: ASSISTANT_ERROR_CODES.dailyLimit,
        message: "You reached today's Sidekick limit. Try again tomorrow, or ask on Discord."
      });
    });

    it("uses the lower token cap on trial and without a wallet", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.countMessage.mockResolvedValue(counts({ dayTokenCount: 500_000 }));

      await expect(service.countMessage("user-1", true)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
      await expect(service.countMessage("user-1", null)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
      await expect(service.countMessage("user-1", false)).resolves.toBeUndefined();

      userUsageRepository.countMessage.mockResolvedValue(counts({ dayTokenCount: 499_999 }));
      await expect(service.countMessage("user-1", true)).resolves.toBeUndefined();
    });
  });

  describe("assertWithinUserTokens", () => {
    it("reads today's tokens of the user and lets them through below the cap", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, userUsageRepository } = setup();
      userUsageRepository.dayTokenCountOf.mockResolvedValue(1_999_999);

      await expect(service.assertWithinUserTokens("user-1", false)).resolves.toBeUndefined();
      expect(userUsageRepository.dayTokenCountOf).toHaveBeenCalledWith("user-1", "2026-11-04");
    });

    it("refuses a user at the cap with the daily limit error", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.dayTokenCountOf.mockResolvedValue(2_000_000);

      await expect(service.assertWithinUserTokens("user-1", false)).rejects.toMatchObject({
        status: 429,
        errorCode: ASSISTANT_ERROR_CODES.dailyLimit,
        message: "You reached today's Sidekick limit. Try again tomorrow, or ask on Discord."
      });
    });

    it("uses the lower token cap on trial and without a wallet", async () => {
      const { service, userUsageRepository } = setup();
      userUsageRepository.dayTokenCountOf.mockResolvedValue(500_000);

      await expect(service.assertWithinUserTokens("user-1", true)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
      await expect(service.assertWithinUserTokens("user-1", null)).rejects.toMatchObject({ status: 429, errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
      await expect(service.assertWithinUserTokens("user-1", false)).resolves.toBeUndefined();

      userUsageRepository.dayTokenCountOf.mockResolvedValue(499_999);
      await expect(service.assertWithinUserTokens("user-1", true)).resolves.toBeUndefined();
    });
  });

  describe("assertWithinBudget", () => {
    it("answers unavailable to everyone once today's tokens reach the budget", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository } = setup();
      tokenUsageRepository.totalsOn.mockResolvedValue({ total: 999, trialTotal: 0 });

      await expect(service.assertWithinBudget(false)).resolves.toBeUndefined();
      expect(tokenUsageRepository.totalsOn).toHaveBeenCalledWith("2026-11-04");

      tokenUsageRepository.totalsOn.mockResolvedValue({ total: 1000, trialTotal: 0 });
      await expect(service.assertWithinBudget(false)).rejects.toMatchObject({ status: 503, errorCode: ASSISTANT_ERROR_CODES.unavailable });
      await expect(service.assertWithinBudget(true)).rejects.toMatchObject({ status: 503, errorCode: ASSISTANT_ERROR_CODES.unavailable });
    });

    it("answers unavailable on trial and without a wallet once trial turns used the trial part of the budget, still serving paying users", async () => {
      const { service, tokenUsageRepository } = setup();
      tokenUsageRepository.totalsOn.mockResolvedValue({ total: 500, trialTotal: 299 });

      await expect(service.assertWithinBudget(true)).resolves.toBeUndefined();

      tokenUsageRepository.totalsOn.mockResolvedValue({ total: 500, trialTotal: 300 });
      await expect(service.assertWithinBudget(true)).rejects.toMatchObject({ status: 503, errorCode: ASSISTANT_ERROR_CODES.unavailable });
      await expect(service.assertWithinBudget(null)).rejects.toMatchObject({ status: 503, errorCode: ASSISTANT_ERROR_CODES.unavailable });
      await expect(service.assertWithinBudget(false)).resolves.toBeUndefined();
    });
  });

  describe("recordUsage", () => {
    it("adds a turn's tokens to the user's count and the shared budget", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository, userUsageRepository } = setup();

      await service.recordUsage("user-1", false, { promptTokens: 10, completionTokens: 5 });

      expect(tokenUsageRepository.add).toHaveBeenCalledWith("2026-11-04", { promptTokens: 10, completionTokens: 5 }, { isTrial: false });
      expect(userUsageRepository.addTokens).toHaveBeenCalledWith("user-1", "2026-11-04", 15);
    });

    it("adds the turn of a trial user or a user without a wallet to the trial part of the budget", async () => {
      const { service, tokenUsageRepository } = setup();

      await service.recordUsage("user-1", true, { promptTokens: 10, completionTokens: 5 });
      await service.recordUsage("user-2", null, { promptTokens: 10, completionTokens: 5 });

      expect(tokenUsageRepository.add).toHaveBeenNthCalledWith(1, expect.any(String), { promptTokens: 10, completionTokens: 5 }, { isTrial: true });
      expect(tokenUsageRepository.add).toHaveBeenNthCalledWith(2, expect.any(String), { promptTokens: 10, completionTokens: 5 }, { isTrial: true });
    });

    it("still adds to the shared budget when the user's count cannot be written", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository, userUsageRepository } = setup();
      const failure = new Error("user usage write failed");
      userUsageRepository.addTokens.mockRejectedValue(failure);

      await expect(service.recordUsage("user-1", false, { promptTokens: 10, completionTokens: 5 })).rejects.toBe(failure);

      expect(tokenUsageRepository.add).toHaveBeenCalledWith("2026-11-04", { promptTokens: 10, completionTokens: 5 }, { isTrial: false });
    });

    it("still adds to the user's count when the shared budget cannot be written", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository, userUsageRepository } = setup();
      const failure = new Error("budget write failed");
      tokenUsageRepository.add.mockRejectedValue(failure);

      await expect(service.recordUsage("user-1", false, { promptTokens: 10, completionTokens: 5 })).rejects.toBe(failure);

      expect(userUsageRepository.addTokens).toHaveBeenCalledWith("user-1", "2026-11-04", 15);
    });

    it("records nothing when the model reported no usage", async () => {
      const { service, tokenUsageRepository, userUsageRepository } = setup();

      await service.recordUsage("user-1", false, null);

      expect(tokenUsageRepository.add).not.toHaveBeenCalled();
      expect(userUsageRepository.addTokens).not.toHaveBeenCalled();
    });

    it("warns once when the day's tokens cross 80% of the budget", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository, logger } = setup();
      const usage = { promptTokens: 15, completionTokens: 5 };

      tokenUsageRepository.add.mockResolvedValueOnce({ total: 790, trialTotal: 0 });
      await service.recordUsage("user-1", false, usage);
      expect(logger.warn).not.toHaveBeenCalled();

      tokenUsageRepository.add.mockResolvedValueOnce({ total: 810, trialTotal: 0 });
      await service.recordUsage("user-1", false, usage);
      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TOKEN_BUDGET_WARNING", day: "2026-11-04", total: 810, budget: 1000 });

      tokenUsageRepository.add.mockResolvedValueOnce({ total: 850, trialTotal: 0 });
      await service.recordUsage("user-1", false, usage);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("warns when the day's tokens land exactly on 80% of the budget", async () => {
      const { service, tokenUsageRepository, logger } = setup();
      tokenUsageRepository.add.mockResolvedValue({ total: 800, trialTotal: 0 });

      await service.recordUsage("user-1", false, { promptTokens: 15, completionTokens: 5 });

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ASSISTANT_TOKEN_BUDGET_WARNING", total: 800 }));
    });

    it("does not warn again when the day's tokens were already at 80% of the budget", async () => {
      const { service, tokenUsageRepository, logger } = setup();
      tokenUsageRepository.add.mockResolvedValue({ total: 820, trialTotal: 0 });

      await service.recordUsage("user-1", false, { promptTokens: 15, completionTokens: 5 });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("warns once when a trial turn uses up the trial part of the budget", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, tokenUsageRepository, logger } = setup();
      const usage = { promptTokens: 15, completionTokens: 5 };

      tokenUsageRepository.add.mockResolvedValueOnce({ total: 500, trialTotal: 299 });
      await service.recordUsage("user-1", true, usage);
      expect(logger.warn).not.toHaveBeenCalled();

      tokenUsageRepository.add.mockResolvedValueOnce({ total: 520, trialTotal: 300 });
      await service.recordUsage("user-1", true, usage);
      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TRIAL_TOKEN_BUDGET_REACHED", day: "2026-11-04", trialTotal: 300, trialBudget: 300 });

      tokenUsageRepository.add.mockResolvedValueOnce({ total: 540, trialTotal: 320 });
      await service.recordUsage("user-1", true, usage);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("does not warn about the trial part of the budget for a paying user's turn", async () => {
      const { service, tokenUsageRepository, logger } = setup();
      tokenUsageRepository.add.mockResolvedValue({ total: 500, trialTotal: 310 });

      await service.recordUsage("user-1", false, { promptTokens: 15, completionTokens: 5 });

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const userUsageRepository = mock<AssistantUserUsageRepository>();
    const tokenUsageRepository = mock<AssistantDailyTokenUsageRepository>();
    tokenUsageRepository.add.mockResolvedValue({ total: 0, trialTotal: 0 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = envSchema.parse({
      ASSISTANT_MESSAGES_PER_MINUTE: "3",
      ASSISTANT_MESSAGES_PER_DAY: "50",
      ASSISTANT_TRIAL_MESSAGES_PER_DAY: "10",
      ASSISTANT_TRIAL_TOTAL_MESSAGES: "20",
      ASSISTANT_DAILY_TOKEN_BUDGET: "1000",
      ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "300"
    });
    const service = new AssistantLimitsService(userUsageRepository, tokenUsageRepository, config, createLogger);

    return { service, userUsageRepository, tokenUsageRepository, logger };
  }
});
