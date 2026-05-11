import type { LoggerService } from "@akashnetwork/logging";
import type { RetryPolicy } from "cockatiel";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";
import { inject, singleton } from "tsyringe";

import { projectRow } from "@src/lib/project-row/project-row";
import { projectedRowsEqual } from "@src/lib/projected-row-equals/projected-row-equals";
import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import { PROVIDER_STREAM_FACTORY } from "@src/providers/provider-stream.provider";
import { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";

const RETRY_EXPONENT = 2;

@singleton()
export class StreamLifecycleManagerService {
  readonly #logger: LoggerService;
  readonly #streamFactory: ProviderStreamFactory;
  readonly #writer: ProviderInventoryWriterService;
  readonly #config: EnvConfig;
  readonly #activeStreams = new Map<string, AbortController>();
  readonly #lastInventoryPerProvider = new Map<string, ProjectedRow>();
  readonly #retryStreamPolicy: RetryPolicy;

  constructor(
    @inject(PROVIDER_STREAM_FACTORY) streamFactory: ProviderStreamFactory,
    @inject(ProviderInventoryWriterService) writer: ProviderInventoryWriterService,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory,
    @inject(APP_CONFIG) config: EnvConfig
  ) {
    this.#streamFactory = streamFactory;
    this.#writer = writer;
    this.#config = config;
    this.#logger = loggerFactory({ context: "StreamLifecycleManager" });
    this.#retryStreamPolicy = retry(handleAll, {
      maxAttempts: Number.POSITIVE_INFINITY,
      backoff: new ExponentialBackoff({
        initialDelay: this.#config.STREAM_RECONNECT_INITIAL_DELAY_MS,
        maxDelay: this.#config.STREAM_RECONNECT_MAX_DELAY_MS,
        exponent: RETRY_EXPONENT
      })
    });
  }

  reconcile(providers: ChainProvider[]): void {
    const currentOwners = new Set(providers.map(p => p.owner));

    for (const [owner, controller] of this.#activeStreams) {
      if (!currentOwners.has(owner)) {
        controller.abort();
        this.#activeStreams.delete(owner);
        this.#lastInventoryPerProvider.delete(owner);
        void this.#tryMarkOffline(owner);
        this.#logger.info({ event: "STREAM_STOPPED_PROVIDER_GONE", owner });
      }
    }

    for (const provider of providers) {
      if (this.#activeStreams.has(provider.owner)) continue;
      this.#startStream(provider);
    }
  }

  #startStream(provider: ChainProvider): void {
    const controller = new AbortController();
    this.#activeStreams.set(provider.owner, controller);
    void this.#runStream(provider, controller.signal);
  }

  async #runStream(provider: ChainProvider, signal: AbortSignal): Promise<void> {
    try {
      await this.#retryStreamPolicy.execute((ctx) => {
        if (ctx.attempt > 0) {
          this.#logger.warn({
            event: "STREAM_RECONNECTING",
            owner: provider.owner,
            attempt: ctx.attempt,
          });
        }
        return this.#runAttempt(provider, signal);
      }, signal);
    } catch (error) {
      if (!signal.aborted) {
        this.#logger.error({ event: "STREAM_GAVE_UP", owner: provider.owner, error });
      }
    } finally {
      this.#lastInventoryPerProvider.delete(provider.owner);
      if (this.#activeStreams.get(provider.owner)?.signal === signal) {
        this.#activeStreams.delete(provider.owner);
      }
    }
  }

  async #runAttempt(provider: ChainProvider, outerSignal: AbortSignal): Promise<void> {
    if (outerSignal.aborted) return;

    this.#lastInventoryPerProvider.delete(provider.owner);

    const attemptController = new AbortController();
    const composite = AbortSignal.any([outerSignal, attemptController.signal]);

    let firstMessageReceived = false;
    const firstMessageTimeoutId = setTimeout(() => {
      attemptController.abort();
    }, this.#config.STREAM_FIRST_MESSAGE_TIMEOUT_MS);

    try {
      const stream = this.#streamFactory.openStatusStream(provider.hostUri, composite);

      for await (const message of stream) {
        if (outerSignal.aborted) return;
        if (!firstMessageReceived) {
          firstMessageReceived = true;
          clearTimeout(firstMessageTimeoutId);
        }
        await this.#applyMessage(provider, message);
      }

      if (outerSignal.aborted) return;

      await this.#tryMarkOffline(provider.owner);

      if (firstMessageReceived) {
        throw new Error("stream ended after delivering messages")
      }
      throw new Error("first message not received within timeout");
    } catch (error) {
      if (outerSignal.aborted) return;
      this.#logger.warn({ event: "STREAM_ATTEMPT_FAILED", owner: provider.owner, error });
      await this.#tryMarkOffline(provider.owner);
      throw error;
    } finally {
      clearTimeout(firstMessageTimeoutId);
    }
  }

  async #applyMessage(provider: ChainProvider, message: Parameters<typeof projectRow>[0]): Promise<void> {
    const row = projectRow(message);
    const cached = this.#lastInventoryPerProvider.get(provider.owner);

    if (cached && projectedRowsEqual(cached, row)) {
      this.#logger.debug({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL", owner: provider.owner });
      return;
    }

    try {
      await this.#writer.upsertInventory(provider, row);
      this.#lastInventoryPerProvider.set(provider.owner, row);
    } catch (error) {
      this.#logger.error({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: provider.owner, error });
    }
  }

  async #tryMarkOffline(owner: string): Promise<void> {
    try {
      await this.#writer.markOffline(owner);
    } catch (error) {
      this.#logger.error({ event: "MARK_OFFLINE_ERROR", owner, error });
    }
  }

  shutdown(): void {
    for (const [owner, controller] of this.#activeStreams) {
      controller.abort();
      this.#logger.info({ event: "STREAM_CLOSED", owner });
    }
    this.#activeStreams.clear();
    this.#lastInventoryPerProvider.clear();
  }

  dispose(): void {
    this.shutdown();
  }
}
