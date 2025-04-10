import { MsgCloseDeployment } from '@akashnetwork/akash-api/v1beta3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { validate } from 'nestjs-zod';

import { ChainEventsController } from '@src/alert/controllers/chain-events/chain-events.controller';
import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
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
      async (event) => {
        try {
          const msg = validate(event.data, MsgCloseDeploymentDto);
          await this.chainEventsController.processDeploymentClosed(msg);
          this.loggerService.log({
            event: 'MESSAGE_WORKER_SUCCESS',
            key: MsgCloseDeployment['$type'],
          });
        } catch (error) {
          console.log('DEBUG error', error);
          this.loggerService.error({
            event: 'MESSAGE_WORKER_FAILURE',
            key: MsgCloseDeployment['$type'],
            message: event,
            error,
          });
          throw error;
        }
      },
    );

    await this.broker.subscribe<ChainBlockCreatedDto>(
      'blockchain.v1.block.created',
      { prefetchCount: 10 },
      async (event) => {
        try {
          const msg = validate(event.data, ChainBlockCreatedDto);
          await this.chainEventsController.processBlock(msg);
          this.loggerService.log({
            event: 'MESSAGE_WORKER_SUCCESS',
            key: 'blockchain.v1.block.created',
          });
        } catch (error) {
          this.loggerService.error({
            event: 'MESSAGE_WORKER_FAILURE',
            key: 'blockchain.v1.block.created',
            message: event,
            error,
          });
          throw error;
        }
      },
    );
  }
}
