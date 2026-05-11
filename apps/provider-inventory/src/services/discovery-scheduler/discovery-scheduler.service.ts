import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";

@singleton()
export class DiscoverySchedulerService {
  readonly #logger: LoggerService;
  readonly #poller: ChainProviderPollerService;
  readonly #writer: ProviderInventoryWriterService;
  readonly #lifecycle: StreamLifecycleManagerService;
  readonly #config: EnvConfig;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #running = false;

  constructor(
    @inject(ChainProviderPollerService) poller: ChainProviderPollerService,
    @inject(ProviderInventoryWriterService) writer: ProviderInventoryWriterService,
    @inject(StreamLifecycleManagerService) lifecycle: StreamLifecycleManagerService,
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
    if (this.#running) return;
    this.#running = true;
    void this.#tick();
  }

  stop(): void {
    this.#running = false;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  async #tick(): Promise<void> {
    if (!this.#running) return;

    try {
      this.#logger.info({ event: "DISCOVERY_TICK_START" });
      const providers = await this.#poller.poll();
      await Promise.all(providers.map(p => this.#writer.upsertAttributes(p)));
      this.#lifecycle.reconcile(providers);
      this.#logger.info({ event: "DISCOVERY_TICK_COMPLETE", providerCount: providers.length });
    } catch (error) {
      this.#logger.error({ event: "DISCOVERY_TICK_ERROR", error });
    }

    if (this.#running) {
      this.#timer = setTimeout(() => void this.#tick(), this.#config.DISCOVERY_INTERVAL_MS);
    }
  }
}
