import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import type { DiscoveryCommand } from "@src/lib/discovery-reconciler/discovery-reconciler";
import { reconcileDiscovery } from "@src/lib/discovery-reconciler/discovery-reconciler";
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
  #timer: ReturnType<typeof setTimeout> | null = null;
  #running = false;

  constructor(
    @inject(ChainProviderPollerService) poller: ChainProviderPollerService,
    @inject(ProviderInventoryRepository) writer: ProviderInventoryRepository,
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

  async discoverProviders(): Promise<void> {
    try {
      this.#logger.info({ event: "DISCOVERY_TICK_START" });
      const providers = await this.#poller.poll();

      const chunkedCommands = chunkify(reconcileDiscovery(this.#lifecycle.getRegistry(), providers), 50);
      for (const commands of chunkedCommands) {
        await Promise.allSettled(commands.map(c => this.#dispatch(c)));
      }

      this.#logger.info({ event: "DISCOVERY_TICK_COMPLETE", providerCount: providers.length });
    } catch (error) {
      this.#logger.error({ event: "DISCOVERY_TICK_ERROR", error });
    }
  }

  async #tick(): Promise<void> {
    if (!this.#running) return;
    await this.discoverProviders();
    if (this.#running) {
      this.#timer = setTimeout(() => void this.#tick(), this.#config.DISCOVERY_INTERVAL_MS);
    }
  }

  async #dispatch(command: DiscoveryCommand): Promise<void> {
    switch (command.kind) {
      case "stop":
        await this.#lifecycle.stopAndDelete(command.owner);
        return;
      case "refreshAttributes":
        await this.#refreshAttributes(command.provider);
        return;
      case "start":
        await this.#refreshAttributes(command.provider);
        this.#lifecycle.start(command.provider);
        return;
      case "restart":
        await this.#refreshAttributes(command.provider);
        this.#lifecycle.restart(command.provider);
        return;
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
