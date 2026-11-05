import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { ASSISTANT_ERROR_CODES, assistantUnavailable } from "@src/feedback/lib/assistant-errors/assistant-errors";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AssistantDailyTokenUsageRepository } from "@src/feedback/repositories/assistant-daily-token-usage/assistant-daily-token-usage.repository";
import { AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@singleton()
export class AssistantLimitsService {
  constructor(
    private readonly assistantUserUsageRepository: AssistantUserUsageRepository,
    private readonly assistantDailyTokenUsageRepository: AssistantDailyTokenUsageRepository,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig
  ) {}

  /** Counts the attempt before checking it, so a client retrying against the limit stays limited. */
  async countMessage(userId: string, isTrialing: boolean | null): Promise<void> {
    const { minuteMessageCount, dayMessageCount } = await this.assistantUserUsageRepository.countMessage(userId, new Date());

    if (minuteMessageCount > this.config.ASSISTANT_MESSAGES_PER_MINUTE) {
      throw createError(429, "You are sending messages too quickly. Wait a minute and try again.", { errorCode: ASSISTANT_ERROR_CODES.rateLimited });
    }

    const dailyLimit = isTrialing ? this.config.ASSISTANT_TRIAL_MESSAGES_PER_DAY : this.config.ASSISTANT_MESSAGES_PER_DAY;
    if (dayMessageCount > dailyLimit) {
      throw createError(429, "You reached today's assistant limit. Try again tomorrow, or ask on Discord.", { errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
    }
  }

  async assertWithinBudget(): Promise<void> {
    if ((await this.assistantDailyTokenUsageRepository.totalOn(dayOf(new Date()))) >= this.config.ASSISTANT_DAILY_TOKEN_BUDGET) {
      throw assistantUnavailable();
    }
  }

  async recordUsage(usage: { promptTokens: number; completionTokens: number } | null): Promise<void> {
    if (!usage) return;

    await this.assistantDailyTokenUsageRepository.add(dayOf(new Date()), usage);
  }
}
