import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/v1beta3';
import { StargateClient } from '@cosmjs/stargate';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { backOff } from 'exponential-backoff';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { setTimeout as delay } from 'timers/promises';

import { LoggerService } from '@src/common/services/logger/logger.service';
import { ShutdownService } from '@src/common/services/shutdown/shutdown.service';
import { BrokerService } from '@src/infrastructure/broker';
import { Namespaced } from '@src/lib/types/namespaced-config.type';
import type { ChainEventsConfig } from '@src/modules/chain/config';
import { BlockCursorRepository } from '@src/modules/chain/repositories/block-cursor/block-cursor.repository';
import { BlockData } from '@src/modules/chain/services/block-message-parser/block-message-parser.service';
import { BlockMessageService } from '../block-message/block-message.service';

@Injectable()
export class ChainEventsPollerService implements OnModuleInit, OnModuleDestroy {
  private shouldActivate: boolean = true;

  private readonly isActive = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly brokerService: BrokerService,
    private readonly blockMessageService: BlockMessageService,
    private readonly loggerService: LoggerService,
    private readonly blockCursorRepository: BlockCursorRepository,
    private readonly stargateClient: StargateClient,
    private readonly shutdownService: ShutdownService,
    private readonly configService: ConfigService<
      Namespaced<'chain-events', ChainEventsConfig>
    >,
  ) {
    this.loggerService.setContext(ChainEventsPollerService.name);
  }

  async onModuleInit(): Promise<void> {
    const blockHeight = await this.ensureInitialized();
    this.subscribeToChainEvents(blockHeight);
  }

  private async ensureInitialized(): Promise<number> {
    const height = await this.stargateClient.getHeight();
    await this.blockCursorRepository.ensureInitialized(height);

    return height;
  }

  private subscribeToChainEvents(blockHeight: number) {
    this.loggerService.log({ event: 'START_CHAIN_POLLER', blockHeight });
    this.processBlocksLooping().catch((error) => {
      this.loggerService.error({
        event: 'CHAIN_POLLER_FAILURE',
        error,
        stack: error.stack,
      });
      this.loggerService.fatal({ event: 'APPLICATION_STOP' });
      this.isActive.next(false);
      this.shutdownService.shutdown();
    });
    this.isActive.next(true);
  }

  private async processBlocksLooping() {
    if (!this.shouldActivate) {
      this.isActive.next(false);
      return;
    }

    const processedBlock = await this.processNextBlockWithRetries();
    await this.delayAfterBlock(processedBlock);
    await this.processBlocksLooping();
  }

  private async processNextBlockWithRetries(): Promise<BlockData> {
    return await backOff(async () => await this.processNextBlock(), {
      ...this.configService.getOrThrow('chain-events.pollingConfig'),
      retry: (error, attempt) => {
        this.logProcessingError(error, attempt);
        return true;
      },
    });
  }

  private async processNextBlock(): Promise<BlockData> {
    return await this.blockCursorRepository.getNextBlockForProcessing(
      async (nextBlockHeight) => {
        this.loggerService.log({
          event: 'PROCESSING_BLOCK',
          blockHeight: nextBlockHeight,
        });

        const block = await this.blockMessageService.getMessages(
          nextBlockHeight,
          [MsgCloseDeployment['$type'], MsgCreateDeployment['$type']],
        );

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

        return block;
      },
    );
  }

  private logProcessingError(error: unknown, attempt: number) {
    const isError = error instanceof Error;
    const errorMessage = isError ? error.message : 'Unknown error';
    const stack = isError ? error.stack : undefined;
    this.loggerService.error({
      event: 'BLOCK_PROCESSING_FAILED',
      message: errorMessage,
      stack,
      attempt,
    });
  }

  private async delayAfterBlock(block: BlockData) {
    const blockTimeMs =
      this.configService.getOrThrow('chain-events.BLOCK_TIME_SEC') * 1000;
    const date = new Date(block.time);
    const nextBlockDate = new Date(date.getTime() + blockTimeMs);
    const now = new Date();
    const nextRunDelay = nextBlockDate.getTime() - now.getTime();

    if (nextRunDelay > 0) {
      await delay(nextRunDelay);
    }
  }

  async onModuleDestroy() {
    await this.finishPolling();
  }

  private async finishPolling() {
    this.shouldActivate = false;
    await firstValueFrom(this.isActive.pipe(filter((isActive) => !isActive)));
  }
}
