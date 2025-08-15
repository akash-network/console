import { inject, singleton } from "tsyringe";

import { AMPLITUDE, type Amplitude } from "@src/core/providers/amplitude.provider";
import { HASHER, type Hasher } from "@src/core/providers/hash.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

type AnalyticsEvent = "user_registered" | "balance_top_up";

@singleton()
export class AnalyticsService {
  constructor(
    @inject(AMPLITUDE) private readonly amplitude: Amplitude,
    @inject(HASHER) private readonly hasher: Hasher,
    private readonly coreConfigService: CoreConfigService,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(AnalyticsService.name);
  }

  track(userId: string, eventName: AnalyticsEvent, eventProperties: Record<string, any> = {}) {
    if (this.shouldSampleUser(userId)) {
      this.amplitude.track(eventName, eventProperties, {
        user_id: userId
      });
      this.loggerService.debug({ event: "ANALYTICS_EVENT_REPORTED", userId, eventName });
    }
  }

  private shouldSampleUser(userId: string): boolean {
    const hashValue = this.hasher.hash(userId);
    const percentage = Math.abs(hashValue) % 100;
    return percentage < this.coreConfigService.get("AMPLITUDE_SAMPLING") * 100;
  }
}
