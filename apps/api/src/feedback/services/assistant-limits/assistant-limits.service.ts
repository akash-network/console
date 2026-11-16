import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  ASSISTANT_ERROR_CODES,
  assistantDailyLimitReached,
  assistantTrialLimitReached,
  assistantUnavailable
} from "@src/feedback/lib/assistant-errors/assistant-errors";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AssistantDailyTokenUsageRepository } from "@src/feedback/repositories/assistant-daily-token-usage/assistant-daily-token-usage.repository";
import { AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";

const BUDGET_WARNING_SHARE = 0.8;

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** An account without a wallet never bought credits either, so it gets the trial limits. */
function isTrialTier(isTrialing: boolean | null): boolean {
  return isTrialing !== false;
}

function crossed(threshold: number, { total, added }: { total: number; added: number }): boolean {
  return total - added < threshold && total >= threshold;
}

@singleton()
export class AssistantLimitsService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly assistantUserUsageRepository: AssistantUserUsageRepository,
    private readonly assistantDailyTokenUsageRepository: AssistantDailyTokenUsageRepository,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantLimitsService.name });
  }

  /** Counts the attempt before checking it, so a client retrying against the limit stays limited. */
  async countMessage(userId: string, isTrialing: boolean | null): Promise<void> {
    const { minuteMessageCount, dayMessageCount, dayTokenCount, totalMessageCount } = await this.assistantUserUsageRepository.countMessage(userId, new Date());

    if (minuteMessageCount > this.config.ASSISTANT_MESSAGES_PER_MINUTE) {
      throw createError(429, "You are sending messages too quickly. Wait a minute and try again.", { errorCode: ASSISTANT_ERROR_CODES.rateLimited });
    }

    const isTrial = isTrialTier(isTrialing);
    if (isTrial && totalMessageCount > this.config.ASSISTANT_TRIAL_TOTAL_MESSAGES) {
      throw assistantTrialLimitReached();
    }

    const dailyMessageLimit = isTrial ? this.config.ASSISTANT_TRIAL_MESSAGES_PER_DAY : this.config.ASSISTANT_MESSAGES_PER_DAY;
    if (dayMessageCount > dailyMessageLimit || dayTokenCount >= this.#dailyTokenLimitOf(isTrial)) {
      throw assistantDailyLimitReached();
    }
  }

  /** Runs before every completion of a turn, since one message can lead to several completions and a resumed turn counts no message. */
  async assertWithinUserTokens(userId: string, isTrialing: boolean | null): Promise<void> {
    if ((await this.assistantUserUsageRepository.dayTokenCountOf(userId, dayOf(new Date()))) >= this.#dailyTokenLimitOf(isTrialTier(isTrialing))) {
      throw assistantDailyLimitReached();
    }
  }

  #dailyTokenLimitOf(isTrial: boolean): number {
    return isTrial ? this.config.ASSISTANT_TRIAL_USER_DAILY_TOKENS : this.config.ASSISTANT_USER_DAILY_TOKENS;
  }

  /** Trial accounts spend from their own part of the budget, so many new accounts can never use up what paying users need. */
  async assertWithinBudget(isTrialing: boolean | null): Promise<void> {
    const { total, trialTotal } = await this.assistantDailyTokenUsageRepository.totalsOn(dayOf(new Date()));

    if (total >= this.config.ASSISTANT_DAILY_TOKEN_BUDGET || (isTrialTier(isTrialing) && trialTotal >= this.config.ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET)) {
      throw assistantUnavailable();
    }
  }

  async recordUsage(userId: string, isTrialing: boolean | null, usage: { promptTokens: number; completionTokens: number } | null): Promise<void> {
    if (!usage) return;

    const day = dayOf(new Date());
    const tokens = usage.promptTokens + usage.completionTokens;
    const isTrial = isTrialTier(isTrialing);
    const [, { total, trialTotal }] = await Promise.all([
      this.assistantUserUsageRepository.addTokens(userId, day, tokens),
      this.assistantDailyTokenUsageRepository.add(day, usage, { isTrial })
    ]);

    const budget = this.config.ASSISTANT_DAILY_TOKEN_BUDGET;
    if (crossed(budget * BUDGET_WARNING_SHARE, { total, added: tokens })) {
      this.#logger.warn({ event: "ASSISTANT_TOKEN_BUDGET_WARNING", day, total, budget });
    }

    const trialBudget = this.config.ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET;
    if (isTrial && crossed(trialBudget, { total: trialTotal, added: tokens })) {
      this.#logger.warn({ event: "ASSISTANT_TRIAL_TOKEN_BUDGET_REACHED", day, trialTotal, trialBudget });
    }
  }
}
