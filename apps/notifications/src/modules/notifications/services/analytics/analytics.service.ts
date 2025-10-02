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
  constructor(
    @Inject("AMPLITUDE") private readonly amplitude: Amplitude,
    @Inject("HASHER") private readonly hasher: Hasher,
    private readonly configService: ConfigService<Namespaced<"notifications", NotificationEnvConfig>>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(AnalyticsService.name);
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
    return percentage < this.configService.get("notifications.AMPLITUDE_SAMPLING") * 100;
  }
}
