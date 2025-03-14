import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/v1beta3';
import { Injectable, OnModuleInit } from '@nestjs/common';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { BlockMessageService } from '../block-message/block-message.service';

@Injectable()
export class ChainEventsService implements OnModuleInit {
  private lastBlockHeight: number = 0;

  constructor(
    private readonly brokerService: BrokerService,
    private readonly blockMessageService: BlockMessageService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(ChainEventsService.name);
  }

  onModuleInit() {
    this.subscribeToChainEvents();
  }

  private subscribeToChainEvents() {
    this.loggerService.log('Subscribing to chain events...');

    setInterval(async () => {
      try {
        const block = await this.blockMessageService.getMessages('latest', [
          MsgCloseDeployment['$type'],
          MsgCreateDeployment['$type'],
        ]);

        if (block.height <= this.lastBlockHeight) {
          return;
        }

        this.lastBlockHeight = block.height;

        await this.brokerService.publishAll([
          {
            eventName: 'blockchain.v1.block.created',
            event: {
              height: block.height,
            },
          },
          ...block.messages.map((message) => ({
            eventName: message.type,
            event: message,
          })),
        ]);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.loggerService.error(
          `Error processing chain events: ${errorMessage}`,
        );
      }
    }, 5000);
  }
}
