import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { chunkify } from "@src/lib/generators/chunkify";
import { providersGauge } from "@src/metrics/metrics";
import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class DiscoverySchedulerService {
  readonly #logger: LoggerService;
  readonly #poller: ChainProviderPollerService;
  readonly #repository: ProviderInventoryRepository;
  readonly #incidentRepository: ProviderIncidentRepository;
  readonly #lifecycle: StreamLifecycleManagerService;
  readonly #config: EnvConfig;
  #abortController: AbortController | null = null;
  #lastIncidentCleanupAt: number | null = null;

  constructor(
    poller: ChainProviderPollerService,
    repository: ProviderInventoryRepository,
    incidentRepository: ProviderIncidentRepository,
    lifecycle: StreamLifecycleManagerService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory
  ) {
    this.#poller = poller;
    this.#repository = repository;
    this.#incidentRepository = incidentRepository;
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
          auditedBy: EMPTY_ARRAY,
          offlineSince: null
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
      const watchedProviders = this.#lifecycle.getRegistry();
      const providersToStop = new Set(watchedProviders.keys());

      this.#logger.info({ event: "DISCOVERY_TICK_START", watchedProviders: watchedProviders.size });

      const startedAt = Date.now();
      let startedProvidersCount = 0;
      let restartedProvidersCount = 0;
      let totalProviders = 0;
      let deadProvidersCount = 0;
      for await (const providers of this.#poller.poll({ signal, batchSize: 500 })) {
        if (signal?.aborted) break;

        // important to upsert before starting new stream,
        // otherwise stream will have nothing to update in the db
        const [updatedProviders, offlineSincePerProvider] = await Promise.all([
          this.#upsertProviders(providers),
          this.#incidentRepository.getOfflineSince(providers.map(p => p.owner))
        ]);
        for (const provider of providers) {
          totalProviders++;
          // The provider is still registered on-chain this tick, so it must never be treated as "gone"
          // and stopped+deleted. Only providers absent from the poll remain in providersToStop. Deleting
          // its inventory row / closing its incident here would erase the very state dead-detection relies
          // on, causing a dead provider to re-appear as brand-new (re-inserted == "updated") next tick.
          providersToStop.delete(provider.owner);

          const observedProvider = watchedProviders.get(provider.owner);
          const offlineSince = offlineSincePerProvider.get(provider.owner);

          if (
            !updatedProviders?.has(provider.owner) &&
            offlineSince &&
            Date.now() - offlineSince.getTime() >= this.#config.DEAD_PROVIDER_UPDATED_THRESHOLD_MS
          ) {
            this.#logger.debug({
              event: "DISCOVERY_SKIP_PROVIDER",
              owner: provider.owner,
              reason: "provider has an open incident older than the dead-provider threshold"
            });
            deadProvidersCount++;
            continue;
          }

          if (!observedProvider) {
            if (updatedProviders) {
              this.#lifecycle.start({ ...provider, offlineSince: offlineSince ?? null }, signal);
              startedProvidersCount++;
            }
          } else if (observedProvider.hostUri !== provider.hostUri) {
            this.#lifecycle.restart({ ...provider, offlineSince: offlineSince ?? null }, signal);
            restartedProvidersCount++;
          }
        }
      }

      for (const chunk of chunkify(providersToStop, 100)) {
        if (signal?.aborted) break;
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

      if (!signal?.aborted) {
        providersGauge.record(totalProviders, { state: "total" });
        providersGauge.record(deadProvidersCount, { state: "dead" });
      }

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

    if (!signal?.aborted) {
      await this.#cleanupOldIncidents();
    }
  }

  async #cleanupOldIncidents(): Promise<void> {
    const now = Date.now();
    if (this.#lastIncidentCleanupAt !== null && now - this.#lastIncidentCleanupAt < this.#config.INCIDENT_CLEANUP_INTERVAL_MS) {
      return;
    }

    const retentionDays = this.#config.INCIDENT_RETENTION_DAYS;
    try {
      const deletedCount = await this.#incidentRepository.deleteEndedBefore(retentionDays);
      this.#lastIncidentCleanupAt = now;
      this.#logger.info({ event: "DISCOVERY_INCIDENTS_CLEANUP", retentionDays, deletedCount });
    } catch (error) {
      this.#logger.error({ event: "DISCOVERY_INCIDENTS_CLEANUP_ERROR", retentionDays, error });
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

  async #upsertProviders(providers: ChainProvider[]) {
    const owners = providers.map(p => p.owner);
    try {
      const updatedProviders = await this.#repository.bulkUpsertProviders(providers);
      this.#logger.debug({ event: "UPSERT_PROVIDERS_UPSERTED", owners });
      return new Set(updatedProviders?.map(p => p.owner) ?? []);
    } catch (error) {
      this.#logger.error({ event: "UPSERT_PROVIDERS_ERROR", owners, error });
      return null;
    }
  }
}
