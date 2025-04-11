import { MsgCloseDeployment } from '@akashnetwork/akash-api/v1beta3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { validate } from 'nestjs-zod';

import { ChainEventsController } from '@src/alert/controllers/chain-events/chain-events.controller';
import { ChainBlockCreatedDto } from "@src/alert/dto/chain-block-created.dto";
import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';

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

    await this.broker.subscribe<MsgCloseDeploymentDto>(
      'blockchain.v1.block.created',
      { prefetchCount: 10 },
      async (events) => {
        await Promise.all(
          events.map(async (event) => {
            const msg = validate(event.data, ChainBlockCreatedDto);
            await this.chainEventsController.processBlock(msg);
          }),
        );
      },
    );
  }
}
