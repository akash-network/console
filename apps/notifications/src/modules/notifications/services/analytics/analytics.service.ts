import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Namespaced } from "@src/lib/types/namespaced-config.type";
import { NotificationEnvConfig } from "@src/modules/notifications/config/env.config";
import { Amplitude } from "@src/modules/notifications/providers/amplitude.provider";
import { Hasher } from "@src/modules/notifications/providers/hash.provider";

type AnalyticsEvent = "email_sent" | "email_failed";

@Injectable()
export class AnalyticsService {
  private readonly samplingRate: number;

  constructor(
    @Inject("AMPLITUDE") private readonly amplitude: Amplitude,
    @Inject("HASHER") private readonly hasher: Hasher,
    private readonly configService: ConfigService<Namespaced<"notifications", NotificationEnvConfig>>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(AnalyticsService.name);
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
    const rawValue = this.configService.getOrThrow("notifications.AMPLITUDE_SAMPLING");
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
