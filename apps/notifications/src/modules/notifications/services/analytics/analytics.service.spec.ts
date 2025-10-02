import type { ConfigService } from "@nestjs/config";
import { mock } from "jest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { Namespaced } from "@src/lib/types/namespaced-config.type";
import type { NotificationEnvConfig } from "@src/modules/notifications/config/env.config";
import type { Amplitude } from "@src/modules/notifications/providers/amplitude.provider";
import type { Hasher } from "@src/modules/notifications/providers/hash.provider";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  it("should track events when user is sampled", async () => {
    const { service, amplitude, loggerService } = await setup();

    service.track("user123", "email_sent", { recipient_count: 1 });

    expect(amplitude.track).toHaveBeenCalledWith("email_sent", { recipient_count: 1 }, { user_id: "user123" });
    expect(loggerService.debug).toHaveBeenCalledWith({
      event: "ANALYTICS_EVENT_REPORTED",
      userId: "user123",
      eventName: "email_sent"
    });
  });

  it("should not track events when user is not sampled", async () => {
    const { service, amplitude, hasher, configService } = await setup();

    jest.spyOn(configService, "get").mockReturnValue("0.0");
    hasher.hash.mockReturnValue(50); // Hash value that would normally be sampled

    service.track("user123", "email_sent", { recipient_count: 1 });

    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("should track email_failed events with error details", async () => {
    const { service, amplitude, loggerService } = await setup();

    service.track("user123", "email_failed", { error: "Network timeout" });

    expect(amplitude.track).toHaveBeenCalledWith("email_failed", { error: "Network timeout" }, { user_id: "user123" });
    expect(loggerService.debug).toHaveBeenCalledWith({
      event: "ANALYTICS_EVENT_REPORTED",
      userId: "user123",
      eventName: "email_failed"
    });
  });

  async function setup() {
    const amplitude = mock<Amplitude>();
    const hasher = mock<Hasher>();
    const configService = mock<ConfigService<Namespaced<"notifications", NotificationEnvConfig>>>();
    const loggerService = mock<LoggerService>();

    jest.spyOn(configService, "get").mockReturnValue("1.0");
    hasher.hash.mockReturnValue(50); // Mock hash value that will be sampled

    const service = new AnalyticsService(amplitude, hasher, configService, loggerService);

    return { service, amplitude, hasher, configService, loggerService };
  }
});
