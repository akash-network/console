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
  readonly #retryStreamPolicy: RetryPolicy;

  constructor(
    streamFactory: ProviderStreamFactory,
    @inject(ProviderInventoryRepository) writer: ProviderInventoryRepository,
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
        maxDelay: this.#config.STREAM_RECONNECT_MAX_DELAY_MS
      })
    });
  }

  getRegistry(): ReadonlyMap<string, { hostUri: string }> {
    return this.#activeStreams;
  }

  start(provider: ChainProvider, signal?: AbortSignal): void {
    const controller = new AbortController();
    this.#activeStreams.set(provider.owner, { controller, hostUri: provider.hostUri });
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    void this.#runStream(provider, controller.signal);
  }

  restart(provider: ChainProvider, signal?: AbortSignal): void {
    this.#abortIfActive(provider.owner, "STREAM_STOPPED_HOSTURI_CHANGE");
    this.start(provider, signal);
  }

  async stopAndDelete(owner: string): Promise<void> {
    this.#abortIfActive(owner, "STREAM_STOPPED_PROVIDER_GONE");
    try {
      await this.#writer.deleteByOwner(owner);
    } catch (error) {
      this.#logger.error({ event: "STREAM_PROVIDER_DELETE_ERROR", owner, error });
    }
  }

  #abortIfActive(owner: string, event: string): void {
    const existing = this.#activeStreams.get(owner);
    if (!existing) return;
    existing.controller.abort();
    this.#activeStreams.delete(owner);
    this.#logger.info({ event, owner });
  }

  async #runStream(provider: ChainProvider, signal: AbortSignal): Promise<void> {
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
        return this.#runAttempt(provider, signal);
      }, signal);
    } catch (error) {
      if (!signal.aborted) {
        this.#logger.error({ event: "STREAM_GAVE_UP", owner: provider.owner, error });
      }
    } finally {
      this.#lastInventoryPerProvider.delete(provider.owner);
      if (this.#activeStreams.get(provider.owner)?.controller.signal === signal) {
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
      const stream = this.#streamFactory.openStatusStream(provider, composite);

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
        throw new Error("stream ended after delivering messages");
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

  async #applyMessage(provider: ChainProvider, message: ClusterState): Promise<void> {
    const row = projectRow(message);
    const cached = this.#lastInventoryPerProvider.get(provider.owner);

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
    try {
      await this.#writer.markOffline(owner);
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
  }

  dispose(): void {
    this.shutdown();
  }
}
