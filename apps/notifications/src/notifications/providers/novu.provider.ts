import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Novu } from '@novu/api';

import type { NotificationsConfig } from '@src/notifications/config';

export const NovuProvider: Provider = {
  provide: Novu,
  useFactory: (configService: ConfigService<NotificationsConfig>) =>
    new Novu({
      secretKey: configService.getOrThrow('notifications.NOVU_SECRET_KEY'),
    }),
  inject: [ConfigService],
};
