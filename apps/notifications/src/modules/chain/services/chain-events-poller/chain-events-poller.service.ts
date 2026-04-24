import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExponentialBackoff, handleAll, retry, TaskCancelledError } from "cockatiel";
import { once } from "events";
import { setTimeout as delay } from "timers/promises";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { LoggerService } from "@src/common/services/logger/logger.service";
import type { HealthzService, ProbeResult } from "@src/common/types/healthz.type";
import { BrokerService } from "@src/infrastructure/broker";
import type { ChainEventsConfig } from "@src/modules/chain/config";
import { BlockCursorRepository } from "@src/modules/chain/repositories/block-cursor/block-cursor.repository";
import { BlockData } from "@src/modules/chain/services/block-message-parser/block-message-parser.service";
import { TxEventsService } from "@src/modules/chain/services/tx-events-service/tx-events.service";
import { BlockMessageService } from "../block-message/block-message.service";

@Injectable()
export class ChainEventsPollerService implements OnApplicationBootstrap, OnModuleDestroy, HealthzService {
  readonly name = "chain-events-poller";

  private readonly abortController = new AbortController();

  private lastProcessedBlockTime?: Date;

  private isStale = false;

  private staleStartedAt?: Date;

  private get signal() {
    return this.abortController.signal;
  }

  private get pollingConfig() {
    return this.configService.getOrThrow("chain.pollingConfig");
  }

  private readonly blockRetryExecutor = retry(handleAll, {
    maxAttempts: this.pollingConfig.numOfAttempts,
    backoff: new ExponentialBackoff({
      initialDelay: this.pollingConfig.startingDelay,
      maxDelay: this.pollingConfig.maxDelay,
      exponent: this.pollingConfig.timeMultiple
    })
  });

  constructor(
    private readonly brokerService: BrokerService,
    private readonly blockMessageService: BlockMessageService,
    private readonly txEventsService: TxEventsService,
    private readonly loggerService: LoggerService,
    private readonly blockCursorRepository: BlockCursorRepository,
    private readonly configService: ConfigService<ChainEventsConfig>
  ) {
    this.loggerService.setContext(ChainEventsPollerService.name);
    this.blockRetryExecutor.onRetry(event => {
      this.logProcessingError("error" in event ? event.error : undefined, event.attempt);
      this.trackBlockStaleness();
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    this.subscribeToChainEvents();
  }

  private subscribeToChainEvents() {
    this.loggerService.log({ event: "START_CHAIN_POLLER" });
    this.processBlocksLooping().catch(error => {
      if (!this.abortController.signal.aborted) {
        this.loggerService.error({ event: "UNEXPECTED_POLLER_FAILURE", error });
      }
    });
  }

  private async processBlocksLooping() {
    try {
      while (!this.signal.aborted) {
        try {
          const processedBlock = await this.processNextBlockWithRetries();
          this.trackBlockProgress(processedBlock);
          await this.delayAfterBlock(processedBlock);
        } catch (error) {
          if (this.signal.aborted || error instanceof TaskCancelledError) break;
          this.loggerService.debug({ event: "CHAIN_POLLER_RETRY", error });
          this.trackBlockStaleness();
          await delay(this.configService.getOrThrow("chain.pollingConfig").maxDelay, null, { signal: this.signal }).catch(e =>
            e?.name === "AbortError" ? undefined : Promise.reject(e)
          );
        }
      }
    } catch (error) {
      if (!this.signal.aborted && !(error instanceof TaskCancelledError)) throw error;
    } finally {
      this.signal.dispatchEvent(new Event("complete"));
    }
  }

  private trackBlockProgress(block: BlockData) {
    this.lastProcessedBlockTime = new Date(block.time);

    if (this.isStale) {
      const staleDurationSeconds = Math.round((Date.now() - (this.staleStartedAt?.getTime() ?? Date.now())) / 1000);
      this.loggerService.log({
        event: "CHAIN_POLLER_RECOVERED",
        blockHeight: block.height,
        staleDurationSeconds
      });
      this.isStale = false;
      this.staleStartedAt = undefined;
    }
  }

  private trackBlockStaleness() {
    if (!this.lastProcessedBlockTime) {
      return;
    }

    const gapSeconds = Math.round((Date.now() - this.lastProcessedBlockTime.getTime()) / 1000);
    const thresholdSeconds = this.configService.getOrThrow("chain.BLOCK_STALE_THRESHOLD_SEC");

    if (gapSeconds > thresholdSeconds && !this.isStale) {
      this.isStale = true;
      this.staleStartedAt = new Date();
      this.loggerService.error({
        event: "CHAIN_POLLER_STALE",
        lastBlockTime: this.lastProcessedBlockTime.toISOString(),
        gapSeconds
      });
    }
  }

  private async processNextBlockWithRetries(): Promise<BlockData> {
    return await this.blockRetryExecutor.execute(async ({ signal: retrySignal }) => {
      retrySignal.throwIfAborted();
      return await this.processNextBlock();
    }, this.signal);
  }

  private async processNextBlock(): Promise<BlockData> {
    return await this.blockCursorRepository.getNextBlockForProcessing(async nextBlockHeight => {
      this.loggerService.log({
        event: "PROCESSING_BLOCK",
        blockHeight: nextBlockHeight
      });

      const block = await this.blockMessageService.getMessages(nextBlockHeight, [MsgCloseDeployment["$type"], MsgCreateDeployment["$type"]], this.signal);

      const txEvents = await this.txEventsService.getBlockEvents(
        nextBlockHeight,
        {
          module: "deployment",
          version: "v1",
          source: "akash",
          action: ["deployment-closed"]
        },
        this.signal
      );

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

  private async delayAfterBlock(block: BlockData) {
    const blockTimeMs = this.configService.getOrThrow("chain.BLOCK_TIME_SEC") * 1000;
    const date = new Date(block.time);
    const nextBlockDate = new Date(date.getTime() + blockTimeMs);
    const nextRunDelay = nextBlockDate.getTime() - Date.now();

    if (nextRunDelay > 0) {
      await delay(nextRunDelay, null, { signal: this.signal }).catch(error => (error?.name === "AbortError" ? undefined : Promise.reject(error)));
    }
  }

  async getReadinessStatus(): Promise<ProbeResult> {
    const isLive = !this.abortController.signal.aborted;
    return {
      status: isLive ? "ok" : "error",
      data: { poller: isLive }
    };
  }

  async getLivenessStatus(): Promise<ProbeResult> {
    return this.getReadinessStatus();
  }

  async onModuleDestroy() {
    await this.finishPolling();
  }

  private async finishPolling() {
    if (!this.abortController.signal.aborted) {
      const completePolling = once(this.abortController.signal, "complete");
      this.abortController.abort();
      await completePolling;
    }
  }
}
