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
  readonly #writer: ProviderInventoryRepository;
  readonly #lifecycle: StreamLifecycleManagerService;
  readonly #config: EnvConfig;
  #abortController: AbortController | null = null;

  constructor(
    poller: ChainProviderPollerService,
    writer: ProviderInventoryRepository,
    lifecycle: StreamLifecycleManagerService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory
  ) {
    this.#poller = poller;
    this.#writer = writer;
    this.#lifecycle = lifecycle;
    this.#config = config;
    this.#logger = loggerFactory({ context: "DiscoveryScheduler" });
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

      let startedProvidersCount = 0;
      let restartedProvidersCount = 0;
      for await (const providers of this.#poller.poll({ signal })) {
        for (const batch of chunkify(providers, 50)) {
          if (signal?.aborted) break;

          await Promise.allSettled(
            batch.map(async provider => {
              if (signal?.aborted) return;

              const observedProvider = watchedProviders.get(provider.owner);
              await this.#refreshAttributes(provider);
              if (!observedProvider) {
                this.#lifecycle.start(provider, signal);
                startedProvidersCount++;
              } else if (observedProvider.hostUri !== provider.hostUri) {
                this.#lifecycle.restart(provider, signal);
                restartedProvidersCount++;
              }

              providersToStop.delete(provider.owner);
            })
          );
        }
      }

      for (const owners of chunkify(providersToStop, 50)) {
        await Promise.allSettled(owners.map(o => this.#lifecycle.stopAndDelete(o)));
      }

      this.#logger.info({
        event: "DISCOVERY_TICK_COMPLETE",
        stoppedCount: providersToStop.size,
        startedCount: startedProvidersCount,
        restartedCount: restartedProvidersCount
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

  async #refreshAttributes(provider: ChainProvider): Promise<void> {
    try {
      await this.#writer.upsertAttributes(provider);
    } catch (error) {
      this.#logger.error({ event: "REFRESH_ATTRIBUTES_ERROR", owner: provider.owner, error });
    }
  }
}
