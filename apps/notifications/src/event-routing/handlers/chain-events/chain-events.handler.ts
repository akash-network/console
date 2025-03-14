import { MsgCloseDeployment } from '@akashnetwork/akash-api/v1beta3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { validate } from 'nestjs-zod';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { ChainEventsController } from '@src/event-routing/controllers/chain-events/chain-events.controller';
import { MsgCloseDeploymentDto } from '@src/event-routing/dto/MsgCloseDeployment.dto';

@Injectable()
export class ChainEventsHandler implements OnModuleInit {
  constructor(
    private readonly broker: BrokerService,
    private readonly chainEventsController: ChainEventsController,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(ChainEventsHandler.name);
  }

  async onModuleInit() {
    await this.broker.subscribe<MsgCloseDeploymentDto>(
      MsgCloseDeployment['$type'],
      { prefetchCount: 10 },
      async (events) => {
        await Promise.all(
          events.map(async (event) => {
            const msg = validate(event.data, MsgCloseDeploymentDto);
            await this.chainEventsController.processDeploymentClosed(msg);
          }),
        );
      },
    );
  }
}
