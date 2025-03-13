import { Injectable } from '@nestjs/common';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { MsgCloseDeploymentDto } from '@src/event-routing/dto/MsgCloseDeployment.dto';
import { EventMatchingService } from '@src/event-routing/services/event-matching/event-matching.service';

@Injectable()
export class ChainEventsController {
  constructor(
    private readonly brokerService: BrokerService,
    private readonly eventMatchingService: EventMatchingService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(ChainEventsController.name);
  }

  async processDeploymentClosed(event: MsgCloseDeploymentDto) {
    this.loggerService.log('received MsgCloseDeployment', event);
    const notifications = await this.eventMatchingService.match(event);

    if (notifications.length > 0) {
      await this.brokerService.publishAll(
        notifications.map((notification) => ({
          eventName: 'notification.v1.send',
          event: notification,
        })),
      );
    }
  }
}
