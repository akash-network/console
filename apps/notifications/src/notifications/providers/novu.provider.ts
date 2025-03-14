import { Provider } from '@nestjs/common';
import { Novu } from '@novu/node';

import { LoggerService } from '@src/common/services/logger.service';

export const NovuProvider: Provider = {
  provide: Novu,
  useFactory: (loggerService: LoggerService) => {
    loggerService.setContext('Novu');
    return {
      trigger: async (trigger: string, payload: any) => {
        loggerService.warn({
          message: 'Triggering Novu notification placeholder',
          trigger,
          payload,
        });
      },
    } as unknown as Novu;
  },
  inject: [LoggerService],
};
