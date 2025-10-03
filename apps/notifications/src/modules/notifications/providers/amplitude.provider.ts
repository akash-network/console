import * as amplitude from "@amplitude/analytics-node";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { NotificationsConfig } from "@src/modules/notifications/config";

export type Amplitude = {
  track: typeof amplitude.track;
};

export const AmplitudeProvider: Provider = {
  provide: "AMPLITUDE",
  useFactory: (configService: ConfigService<NotificationsConfig>) => {
    const apiKey = configService.getOrThrow("notifications.AMPLITUDE_API_KEY");
    amplitude.init(apiKey);
    return amplitude;
  },
  inject: [ConfigService]
};
