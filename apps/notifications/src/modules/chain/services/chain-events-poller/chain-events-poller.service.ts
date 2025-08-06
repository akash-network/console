import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/akash-api/v1beta3";
import { StargateClient } from "@cosmjs/stargate";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { once } from "events";
import { backOff } from "exponential-backoff";
import { setTimeout as delay } from "timers/promises";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { LoggerService } from "@src/common/services/logger/logger.service";
import { ShutdownService } from "@src/common/services/shutdown/shutdown.service";
import { BrokerService } from "@src/infrastructure/broker";
import type { ChainEventsConfig } from "@src/modules/chain/config";
import { BlockCursorRepository } from "@src/modules/chain/repositories/block-cursor/block-cursor.repository";
import { BlockData } from "@src/modules/chain/services/block-message-parser/block-message-parser.service";
import { TxEventsService } from "@src/modules/chain/services/tx-events-service/tx-events.service";
import { BlockMessageService } from "../block-message/block-message.service";

@Injectable()
export class ChainEventsPollerService implements OnModuleInit, OnModuleDestroy {
  private abortController?: AbortController;

  constructor(
    private readonly brokerService: BrokerService,
    private readonly blockMessageService: BlockMessageService,
    private readonly txEventsService: TxEventsService,
    private readonly loggerService: LoggerService,
    private readonly blockCursorRepository: BlockCursorRepository,
    private readonly stargateClient: StargateClient,
    private readonly shutdownService: ShutdownService,
    private readonly configService: ConfigService<ChainEventsConfig>
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
    this.abortController = new AbortController();
    this.loggerService.log({ event: "START_CHAIN_POLLER", blockHeight });
    this.processBlocksLooping().catch(error => {
      this.abortController?.abort();
      this.loggerService.error({
        event: "CHAIN_POLLER_FAILURE",
        error
      });
      this.loggerService.fatal({ event: "APPLICATION_STOP" });
      this.shutdownService.shutdown();
    });
  }

  private async processBlocksLooping() {
    const signal = this.abortController?.signal;
    while (signal && !signal.aborted) {
      const processedBlock = await this.processNextBlockWithRetries();
      await this.delayAfterBlock(processedBlock, signal);
    }
    signal?.dispatchEvent(new Event("complete"));
  }

  private async processNextBlockWithRetries(): Promise<BlockData> {
    return await backOff(async () => await this.processNextBlock(), {
      ...this.configService.getOrThrow("chain.pollingConfig"),
      retry: (error, attempt) => {
        this.logProcessingError(error, attempt);
        return true;
      }
    });
  }

  private async processNextBlock(): Promise<BlockData> {
    return await this.blockCursorRepository.getNextBlockForProcessing(async nextBlockHeight => {
      this.loggerService.log({
        event: "PROCESSING_BLOCK",
        blockHeight: nextBlockHeight
      });

      const block = await this.blockMessageService.getMessages(nextBlockHeight, [MsgCloseDeployment["$type"], MsgCreateDeployment["$type"]]);

      const txEvents = await this.txEventsService.getBlockEvents(nextBlockHeight, { type: "akash.v1", action: ["deployment-closed"] });

      await this.brokerService.publishAll([
        {
          eventName: eventKeyRegistry.blockCreated,
          event: {
            height: block.height
          }
        },
        ...block.messages.map(message => ({
          eventName: message.type,
          event: message
        })),
        ...txEvents.map(event => ({
          eventName: `${event.type}.${event.module}.${event.action}`,
          event: event
        }))
      ]);

      return block;
    });
  }

  private logProcessingError(error: unknown, attempt: number) {
    this.loggerService.error({
      event: "BLOCK_PROCESSING_FAILED",
      error,
      attempt
    });
  }

  private async delayAfterBlock(block: BlockData, signal: AbortSignal) {
    const blockTimeMs = this.configService.getOrThrow("chain.BLOCK_TIME_SEC") * 1000;
    const date = new Date(block.time);
    const nextBlockDate = new Date(date.getTime() + blockTimeMs);
    const nextRunDelay = nextBlockDate.getTime() - Date.now();

    if (nextRunDelay > 0) {
      await delay(nextRunDelay, null, { signal }).catch(error => (error?.name === "AbortError" ? undefined : Promise.reject(error)));
    }
  }

  async onModuleDestroy() {
    await this.finishPolling();
  }

  private async finishPolling() {
    if (this.abortController) {
      const completePolling = once(this.abortController.signal, "complete");
      this.abortController.abort();
      await completePolling;
      this.abortController = undefined;
    }
  }
}
