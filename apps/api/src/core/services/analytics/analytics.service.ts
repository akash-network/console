import { inject, singleton } from "tsyringe";

import { AMPLITUDE, type Amplitude } from "@src/core/providers/amplitude.provider";
import { HASHER, type Hasher } from "@src/core/providers/hash.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

type AnalyticsEvent = "user_registered" | "balance_top_up";

@singleton()
export class AnalyticsService {
  private readonly samplingRate: number;

  constructor(
    @inject(AMPLITUDE) private readonly amplitude: Amplitude,
    @inject(HASHER) private readonly hasher: Hasher,
    private readonly coreConfigService: CoreConfigService,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(AnalyticsService.name);
    this.samplingRate = this.validateSamplingRate();
  }

  track(userId: string, eventName: AnalyticsEvent, eventProperties: Record<string, unknown> = {}) {
    if (this.shouldSampleUser(userId)) {
      const amplitudeProperties = eventProperties as Record<string, unknown>;
      this.amplitude.track(eventName, amplitudeProperties, {
        user_id: userId
      });
      this.loggerService.debug({ event: "ANALYTICS_EVENT_REPORTED", userId, eventName });
    }
  }

  private shouldSampleUser(userId: string): boolean {
    const hashValue = this.hasher.hash(userId);
    const percentage = Math.abs(hashValue) % 100;
    return percentage < this.samplingRate * 100;
  }

  private validateSamplingRate(): number {
    const rawValue = this.coreConfigService.get("AMPLITUDE_SAMPLING");
    const samplingRate = Number(rawValue);

    if (!Number.isFinite(samplingRate)) {
      throw new Error(`Invalid AMPLITUDE_SAMPLING value: "${rawValue}". Must be a finite number.`);
    }

    if (samplingRate < 0 || samplingRate > 1) {
      throw new Error(`Invalid AMPLITUDE_SAMPLING value: ${samplingRate}. Must be between 0 and 1 (inclusive).`);
    }

    return samplingRate;
  }
}
