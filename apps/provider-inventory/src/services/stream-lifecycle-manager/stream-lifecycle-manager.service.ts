import type { LoggerService } from "@akashnetwork/logging";
import { Sema } from "async-sema";
import type { RetryPolicy } from "cockatiel";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";
import Dataloader from "dataloader";
import once from "lodash/once";
import { inject, singleton } from "tsyringe";

import { projectRow } from "@src/lib/project-row/project-row";
import { projectedRowsEqual } from "@src/lib/projected-row-equals/projected-row-equals";
import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";
import type { ClusterState } from "@src/types/inventory.types";
import { ProviderStreamFactory } from "../provider-stream-factory/provider-stream-factory.sevice";

@singleton()
export class StreamLifecycleManagerService {
  readonly #logger: LoggerService;
  readonly #streamFactory: ProviderStreamFactory;
  readonly #writer: ProviderInventoryRepository;
  readonly #config: EnvConfig;
  readonly #activeStreams = new Map<
    string,
    {
      controller: AbortController;
      hostUri: string;
    }
  >();
  readonly #lastInventoryPerProvider = new Map<string, ProjectedRow>();
  readonly #onlineStatePerProvider = new Map<string, boolean>();
  readonly #retryStreamPolicy: RetryPolicy;
  readonly #offlineDataloader: Dataloader<string, null>;
  readonly #startStreamSemaphore: Sema;
  readonly #pendingFirstAttempts = new Set<Promise<void>>();

  constructor(
    streamFactory: ProviderStreamFactory,
    writer: ProviderInventoryRepository,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory,
    @inject(APP_CONFIG) config: EnvConfig
  ) {
    this.#streamFactory = streamFactory;
    this.#writer = writer;
    this.#config = config;
    this.#logger = loggerFactory({ context: "StreamLifecycleManager" });
    this.#retryStreamPolicy = retry(handleAll, {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({
        initialDelay: this.#config.STREAM_RECONNECT_INITIAL_DELAY_MS,
        maxDelay: this.#config.STREAM_RECONNECT_MAX_DELAY_MS
      })
    });
    this.#offlineDataloader = new Dataloader(
      async owners => {
        await this.#writer.bulkMarkOffline(owners as string[]);
        return Array.from(owners, () => null);
      },
      {
        cache: false,
        maxBatchSize: 1000,
        batchScheduleFn: callback => setTimeout(callback, 1000)
      }
    );
    this.#startStreamSemaphore = new Sema(this.#config.MAX_CONCURRENT_STREAM_CONNECTIONS);
  }

  getRegistry(): ReadonlyMap<string, { hostUri: string }> {
    return this.#activeStreams;
  }

  start(provider: ChainProvider, signal?: AbortSignal): void {
    const controller = new AbortController();
    this.#activeStreams.set(provider.owner, { controller, hostUri: provider.hostUri });
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    const firstAttempt = Promise.withResolvers<void>();
    this.#pendingFirstAttempts.add(firstAttempt.promise);
    firstAttempt.promise.finally(() => this.#pendingFirstAttempts.delete(firstAttempt.promise));

    void this.#runStream(provider, controller.signal, firstAttempt.resolve);
  }

  restart(provider: ChainProvider, signal?: AbortSignal): void {
    this.#abortIfActive(provider.owner, "STREAM_STOPPED_HOSTURI_CHANGE");
    this.start(provider, signal);
  }

  async waitForPendingConnections(): Promise<void> {
    await Promise.allSettled(this.#pendingFirstAttempts);
  }

  async stopAndDelete(owners: string[]): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const owner of owners) {
      promises.push(this.#streamFactory.disposeProvider(this.#activeStreams.get(owner)?.hostUri ?? ""));
      this.#abortIfActive(owner, "STREAM_STOPPED_PROVIDER_GONE");
    }

    await Promise.all([Promise.all(promises), this.#writer.deleteByOwner(owners)]);
    this.#logger.info({ event: "PROVIDER_INVENTORY_DELETED", owners });
  }

  #abortIfActive(owner: string, event: string): void {
    const existing = this.#activeStreams.get(owner);
    if (!existing) return;
    existing.controller.abort();
    this.#activeStreams.delete(owner);
    this.#logger.info({ event, owner });
  }

  async #runStream(provider: ChainProvider, signal: AbortSignal, onFirstAttemptSettled: () => void): Promise<void> {
    const onSettleAttempt = once(onFirstAttemptSettled);
    try {
      await this.#retryStreamPolicy.execute(ctx => {
        if (signal.aborted) return;
        if (ctx.attempt > 0) {
          this.#logger.warn({
            event: "STREAM_RECONNECTING",
            owner: provider.owner,
            attempt: ctx.attempt
          });
        }
        return this.#runAttempt(provider, signal, onSettleAttempt);
      }, signal);
    } catch (error) {
      if (!signal.aborted) {
        this.#logger.error({ event: "STREAM_GAVE_UP", owner: provider.owner, error });
      }
    } finally {
      onSettleAttempt();
      this.#lastInventoryPerProvider.delete(provider.owner);
      this.#onlineStatePerProvider.delete(provider.owner);
      if (this.#activeStreams.get(provider.owner)?.controller.signal === signal) {
        this.#activeStreams.delete(provider.owner);
      }
    }
  }

  async #runAttempt(provider: ChainProvider, outerSignal: AbortSignal, onAttemptSettled: () => void): Promise<void> {
    if (outerSignal.aborted) return;

    this.#lastInventoryPerProvider.delete(provider.owner);

    const attemptController = new AbortController();
    const forwardAbort = () => attemptController.abort();
    outerSignal.addEventListener("abort", forwardAbort, { once: true });
    if (outerSignal.aborted) {
      forwardAbort();
    }

    await this.#startStreamSemaphore.acquire();
    const firstMessageTimeoutId = setTimeout(() => {
      attemptController.abort(new Error("first message not received within timeout"));
    }, this.#config.STREAM_FIRST_MESSAGE_TIMEOUT_MS);
    const releasePermit = once(() => {
      onAttemptSettled();
      this.#startStreamSemaphore.release();
      clearTimeout(firstMessageTimeoutId);
    });

    try {
      const stream = this.#streamFactory.openStatusStream(provider, attemptController.signal);

      for await (const message of stream) {
        this.#logger.debug({ event: "STREAM_MESSAGE_RECEIVED", owner: provider.owner });
        if (outerSignal.aborted) return;
        releasePermit();
        await this.#applyMessage(provider, message);
      }

      if (outerSignal.aborted) return;
      await this.#tryMarkOffline(provider.owner);

      throw new Error("provider inventory stream ended");
    } catch (error) {
      if (outerSignal.aborted) return;
      this.#logger.warn({ event: "STREAM_ATTEMPT_FAILED", owner: provider.owner, error });
      await this.#tryMarkOffline(provider.owner);
      throw error;
    } finally {
      releasePermit();
      outerSignal.removeEventListener("abort", forwardAbort);
    }
  }

  async #applyMessage(provider: ChainProvider, message: ClusterState): Promise<void> {
    const row = projectRow(message);
    const cached = this.#lastInventoryPerProvider.get(provider.owner);

    if (!this.#onlineStatePerProvider.get(provider.owner)) {
      this.#onlineStatePerProvider.set(provider.owner, true);
    }

    if (cached && projectedRowsEqual(cached, row)) {
      this.#logger.debug({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL", owner: provider.owner });
      return;
    }

    try {
      await this.#writer.updateInventory(provider, row);
      this.#lastInventoryPerProvider.set(provider.owner, row);
    } catch (error) {
      this.#logger.error({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: provider.owner, error });
    }
  }

  async #tryMarkOffline(owner: string): Promise<void> {
    if (this.#onlineStatePerProvider.get(owner) === false) {
      await new Promise(resolve => setImmediate(resolve));
      return;
    }
    try {
      await this.#offlineDataloader.load(owner);
      this.#onlineStatePerProvider.set(owner, false);
    } catch (error) {
      this.#logger.error({ event: "MARK_OFFLINE_ERROR", owner, error });
    }
  }

  shutdown(): void {
    for (const [owner, stream] of this.#activeStreams) {
      stream.controller.abort();
      this.#logger.info({ event: "STREAM_CLOSED", owner });
    }
    this.#activeStreams.clear();
    this.#lastInventoryPerProvider.clear();
    this.#onlineStatePerProvider.clear();
  }

  dispose(): void {
    this.shutdown();
  }
}
