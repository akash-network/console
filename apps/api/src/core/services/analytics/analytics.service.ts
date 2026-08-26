import { inject, singleton } from "tsyringe";

import { AMPLITUDE, type Amplitude } from "@src/core/providers/amplitude.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";

type AnalyticsEvent = "user_registered" | "balance_top_up" | "balance_refund" | "first_purchase_bonus_granted";

@singleton()
export class AnalyticsService {
  private readonly loggerService: ReturnType<CreateLogger>;

  constructor(
    @inject(AMPLITUDE) private readonly amplitude: Amplitude,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: AnalyticsService.name });
  }

  identify(userId: string, userProperties: Record<string, unknown> = {}) {
    const identifyObj = new this.amplitude.Identify();
    Object.entries(userProperties).forEach(([key, value]) => {
      identifyObj.set(key, value as string | number | boolean | string[] | number[]);
    });
    this.amplitude.identify(identifyObj, {
      user_id: userId
    });
    this.loggerService.debug({ event: "ANALYTICS_USER_IDENTIFIED", userId });
  }

  track(userId: string, eventName: AnalyticsEvent, eventProperties: Record<string, unknown> = {}) {
    const amplitudeProperties = eventProperties as Record<string, unknown>;
    this.amplitude.track(eventName, amplitudeProperties, {
      user_id: userId
    });
    this.loggerService.debug({ event: "ANALYTICS_EVENT_REPORTED", userId, eventName });
  }
}
