import { Injectable } from '@nestjs/common';

import { LoggerService } from '@src/common/services/logger.service';

export type NotificationParams = {
  channel: {
    type: 'email';
    address: string;
  };
  userId: string;
  payload: string;
};

@Injectable()
export class EventMatchingService {
  constructor(private readonly loggerService: LoggerService) {
    this.loggerService.setContext(EventMatchingService.name);
  }
  async match(event: object): Promise<NotificationParams[]> {
    this.loggerService.debug('Matching event', event);

    return [
      {
        channel: {
          type: 'email',
          address: 'john.doe@mail.com',
        },
        userId: 'some-user-id',
        payload: 'New event',
      },
    ];
  }
}
