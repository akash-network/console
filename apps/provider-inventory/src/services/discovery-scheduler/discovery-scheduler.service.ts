import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { chunkify } from "@src/lib/generators/chunkify";
import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class DiscoverySchedulerService {
  readonly #logger: LoggerService;
  readonly #poller: ChainProviderPollerService;
  readonly #repository: ProviderInventoryRepository;
  readonly #lifecycle: StreamLifecycleManagerService;
  readonly #config: EnvConfig;
  #abortController: AbortController | null = null;

  constructor(
    poller: ChainProviderPollerService,
    repository: ProviderInventoryRepository,
    lifecycle: StreamLifecycleManagerService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory
  ) {
    this.#poller = poller;
    this.#repository = repository;
    this.#lifecycle = lifecycle;
    this.#config = config;
    this.#logger = loggerFactory({ context: "DiscoveryScheduler" });
  }

  async warmUp(signal?: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    let providerCount = 0;
    const EMPTY_ARRAY = Object.freeze([]) as never[];

    for await (const provider of this.#repository.streamOnlineProviders()) {
      this.#lifecycle.start(
        {
          ...provider,
          selfAttributes: EMPTY_ARRAY,
          signedAttributes: EMPTY_ARRAY,
          auditedBy: EMPTY_ARRAY
        },
        signal
      );
      providerCount++;
    }

    if (providerCount === 0) {
      this.#logger.info({ event: "DISCOVERY_ONLINE_WARM_UP_SKIPPED", reason: "no_known_online_providers" });
      return;
    }

    this.#logger.info({
      event: "DISCOVERY_ONLINE_WARM_UP_STARTED",
      providerCount,
      completedInMs: Date.now() - startedAt
    });
  }

  start(): void {
    if (this.#abortController) return;
    this.#abortController = new AbortController();
    void this.#runDiscoveryLoop(this.#abortController.signal);
  }

  stop(): void {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  async discoverProviders(signal?: AbortSignal): Promise<void> {
    try {
      this.#logger.info({ event: "DISCOVERY_TICK_START" });
      const watchedProviders = this.#lifecycle.getRegistry();
      const providersToStop = new Set(watchedProviders.keys());

      this.#logger.info({ event: "DISCOVERY_CURRENT_REGISTRY", providerCount: watchedProviders.size });

      const startedAt = Date.now();
      let startedProvidersCount = 0;
      let restartedProvidersCount = 0;
      for await (const providers of this.#poller.poll({ signal, batchSize: 500 })) {
        if (signal?.aborted) break;

        // important to upsert before starting new stream,
        // otherwise stream will have nothing to update in the db
        const isUpsertedBatch = await this.#upsertProviders(providers);
        for (const provider of providers) {
          const observedProvider = watchedProviders.get(provider.owner);
          if (!observedProvider) {
            if (isUpsertedBatch) {
              this.#lifecycle.start(provider, signal);
              startedProvidersCount++;
            }
          } else if (observedProvider.hostUri !== provider.hostUri) {
            this.#lifecycle.restart(provider, signal);
            restartedProvidersCount++;
          }

          providersToStop.delete(provider.owner);
        }
      }

      for (const chunk of chunkify(providersToStop, 100)) {
        await this.#lifecycle.stopAndDelete(chunk as string[]);
      }

      this.#logger.info({
        event: "DISCOVERY_TICK_COMPLETE",
        stoppedCount: providersToStop.size,
        startedCount: startedProvidersCount,
        restartedCount: restartedProvidersCount,
        completedInMs: Date.now() - startedAt
      });

      await this.#lifecycle.waitForPendingConnections();

      this.#logger.info({
        event: "DISCOVERY_PROVIDERS_INVENTORY_CONNECTED",
        stoppedCount: providersToStop.size,
        startedCount: startedProvidersCount,
        restartedCount: restartedProvidersCount,
        completedInMs: Date.now() - startedAt
      });
    } catch (error) {
      this.#logger.error({ event: "DISCOVERY_TICK_ERROR", error });
    }
  }

  async #runDiscoveryLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      await this.discoverProviders(signal);
      if (signal.aborted) break;
      await new Promise<void>(resolve => {
        const clearDelay = () => {
          clearTimeout(timerId);
          resolve();
        };
        const timerId = setTimeout(() => {
          signal.removeEventListener("abort", clearDelay);
          resolve();
        }, this.#config.DISCOVERY_INTERVAL_MS);
        signal.addEventListener("abort", clearDelay, { once: true });
      });
    }
  }

  async #upsertProviders(providers: ChainProvider[]): Promise<boolean> {
    const owners = providers.map(p => p.owner);
    try {
      await this.#repository.bulkUpsertProviders(providers);
      this.#logger.debug({ event: "UPSERT_PROVIDERS_UPSERTED", owners });
      return true;
    } catch (error) {
      this.#logger.error({ event: "UPSERT_PROVIDERS_ERROR", owners, error });
      return false;
    }
  }
}
