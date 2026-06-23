import type { LoggerService } from "@akashnetwork/logging";
import { Sema } from "async-sema";
import type { RetryPolicy } from "cockatiel";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";
import Dataloader from "dataloader";
import once from "lodash/once";
import { inject, singleton } from "tsyringe";

import { isEqualClusterState } from "@src/domain/is-equal-cluster-state/is-equal-cluster-state";
import { throttleLatest } from "@src/lib/generators/throttle-latest/throttle-latest";
import { providerInventoryStreamUpdates, providersGauge } from "@src/metrics/metrics";
import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { DbDriver } from "@src/repositories/db-driver/db-driver";
import { ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProviderWithOfflineSince } from "@src/types/chain-provider";
import type { ClusterState } from "@src/types/inventory";
import { ProviderStreamFactory } from "../provider-stream-factory/provider-stream-factory.sevice";
import { TimerService } from "../timer/timer.service";

@singleton()
export class StreamLifecycleManagerService {
  readonly #logger: LoggerService;
  readonly #streamFactory: ProviderStreamFactory;
  readonly #inventoryRepo: ProviderInventoryRepository;
  readonly #incidentsRepo: ProviderIncidentRepository;
  readonly #config: EnvConfig;
  readonly #activeStreams = new Map<
    string,
    {
      controller: AbortController;
      hostUri: string;
    }
  >();
  readonly #lastInventoryPerProvider = new Map<string, ClusterState>();
  readonly #onlineStatePerProvider = new Map<string, boolean>();
  #onlineProvidersCount = 0;
  readonly #healthyProviderRetryStreamPolicy: RetryPolicy;
  readonly #potentiallyDeadProviderRetryStreamPolicy: RetryPolicy;
  readonly #offlineDataloader: Dataloader<{ owner: string; requestedAt: Date }, boolean>;
  readonly #startStreamSemaphore: Sema;
  readonly #pendingFirstAttempts = new Set<Promise<void>>();
  readonly #dbDriver: DbDriver;
  readonly #timer: TimerService;
  #isShutDown = false;

  constructor(
    streamFactory: ProviderStreamFactory,
    inventoryRepo: ProviderInventoryRepository,
    incidentsRepo: ProviderIncidentRepository,
    dbDriver: DbDriver,
    timer: TimerService,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory,
    @inject(APP_CONFIG) config: EnvConfig
  ) {
    this.#streamFactory = streamFactory;
    this.#inventoryRepo = inventoryRepo;
    this.#incidentsRepo = incidentsRepo;
    this.#dbDriver = dbDriver;
    this.#timer = timer;
    this.#config = config;
    this.#logger = loggerFactory({ context: "StreamLifecycleManager" });
    this.#healthyProviderRetryStreamPolicy = retry(handleAll, {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({
        initialDelay: this.#config.STREAM_RECONNECT_INITIAL_DELAY_MS,
        maxDelay: this.#config.STREAM_RECONNECT_MAX_DELAY_MS
      })
    });
    this.#potentiallyDeadProviderRetryStreamPolicy = retry(handleAll, {
      maxAttempts: 1,
      backoff: new ExponentialBackoff({
        initialDelay: this.#config.STREAM_RECONNECT_INITIAL_DELAY_MS,
        maxDelay: this.#config.STREAM_RECONNECT_MAX_DELAY_MS
      })
    });
    this.#offlineDataloader = new Dataloader(
      async keys => {
        if (this.#isShutDown) return Array.from(keys, () => false);
        const owners = keys.map(k => k.owner);
        const results = await this.#inventoryRepo.bulkMarkOffline(owners, keys[0].requestedAt);
        const updatedOwners = new Set(results.map(r => r.owner));
        return Array.from(owners, owner => updatedOwners.has(owner));
      },
      {
        cache: false,
        maxBatchSize: 500,
        batchScheduleFn: callback => this.#timer.delayCb(callback, 1000).unref()
      }
    );
    this.#startStreamSemaphore = new Sema(this.#config.MAX_CONCURRENT_STREAM_CONNECTIONS);
  }

  getRegistry(): ReadonlyMap<string, { hostUri: string }> {
    return this.#activeStreams;
  }

  async start(provider: ChainProviderWithOfflineSince, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      this.#logger.warn({ event: "STREAM_START_ABORTED", owner: provider.owner, reason: "Received already aborted signal" });
      return;
    }

    const controller = new AbortController();
    const abortProviderStream = () => controller.abort();
    this.#activeStreams.set(provider.owner, { controller, hostUri: provider.hostUri });
    this.#recordMonitoredCount();
    signal?.addEventListener("abort", abortProviderStream, { once: true });

    const firstAttempt = Promise.withResolvers<void>();
    this.#pendingFirstAttempts.add(firstAttempt.promise);
    firstAttempt.promise.finally(() => {
      this.#pendingFirstAttempts.delete(firstAttempt.promise);
    });

    await this.#runStream(provider, controller.signal, firstAttempt.resolve).finally(() => signal?.removeEventListener("abort", abortProviderStream));
  }

  async restart(provider: ChainProviderWithOfflineSince, signal?: AbortSignal): Promise<void> {
    const previousHostUri = this.#activeStreams.get(provider.owner)?.hostUri;
    this.#abortIfActive(provider.owner, "STREAM_STOPPED_HOSTURI_CHANGE");
    await Promise.all([
      previousHostUri && previousHostUri !== provider.hostUri
        ? this.#streamFactory.disposeProvider(previousHostUri).catch(error => {
            this.#logger.error({ event: "DISPOSE_STREAM_ERROR", owner: provider.owner, hostUri: previousHostUri, error });
          })
        : undefined,
      this.start(provider, signal)
    ]);
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

    await Promise.all([Promise.all(promises), this.#inventoryRepo.deleteByOwner(owners), this.#incidentsRepo.closeIncident(owners)]);
    this.#logger.info({ event: "PROVIDER_INVENTORY_DELETED", owners });
  }

  #abortIfActive(owner: string, event: string): void {
    const existing = this.#activeStreams.get(owner);
    if (!existing) return;
    existing.controller.abort();
    this.#activeStreams.delete(owner);
    this.#recordMonitoredCount();
    this.#logger.info({ event, owner });
  }

  async #runStream(provider: ChainProviderWithOfflineSince, signal: AbortSignal, onFirstAttemptSettled: () => void): Promise<void> {
    const onSettleAttempt = once(onFirstAttemptSettled);
    try {
      const isPotentiallyDeadProvider =
        provider.offlineSince && Date.now() - provider.offlineSince.getTime() > this.#config.DEAD_PROVIDER_UPDATED_THRESHOLD_MS / 2;
      const retryPolicy = isPotentiallyDeadProvider ? this.#potentiallyDeadProviderRetryStreamPolicy : this.#healthyProviderRetryStreamPolicy;
      await retryPolicy.execute(ctx => {
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
        try {
          await this.#incidentsRepo.openIncident(provider.owner);
        } catch (incidentError) {
          this.#logger.error({ event: "OPEN_INCIDENT_ERROR", owner: provider.owner, error: incidentError });
        }
      }
    } finally {
      onSettleAttempt();
      this.#lastInventoryPerProvider.delete(provider.owner);
      this.#forgetProviderState(provider.owner);
      const activeStream = this.#activeStreams.get(provider.owner);
      if (activeStream?.controller.signal === signal) {
        this.#streamFactory.disposeProvider(activeStream.hostUri).catch(error => {
          this.#logger.error({ event: "DISPOSE_STREAM_ERROR", owner: provider.owner, hostUri: activeStream.hostUri, error });
        });
        this.#activeStreams.delete(provider.owner);
        this.#recordMonitoredCount();
      }
    }
  }

  async #runAttempt(provider: ChainProviderWithOfflineSince, outerSignal: AbortSignal, onAttemptSettled: () => void): Promise<void> {
    if (outerSignal.aborted) return;

    this.#lastInventoryPerProvider.delete(provider.owner);

    const attemptController = new AbortController();
    const forwardAbort = () => attemptController.abort();
    outerSignal.addEventListener("abort", forwardAbort, { once: true });
    if (outerSignal.aborted) {
      forwardAbort();
    }

    await this.#startStreamSemaphore.acquire();
    const firstMessageTimeoutId = this.#timer
      .delayCb(() => {
        attemptController.abort(new Error("first message not received within timeout"));
      }, this.#config.STREAM_FIRST_MESSAGE_TIMEOUT_MS)
      .unref();
    const releasePermit = once(() => {
      onAttemptSettled();
      this.#startStreamSemaphore.release();
      clearTimeout(firstMessageTimeoutId);
    });

    try {
      const stream = this.#streamFactory.openStatusStream(provider, attemptController.signal);
      const throttled = throttleLatest(stream, this.#config.STREAM_UPDATE_THROTTLE_MS, { signal: attemptController.signal });

      for await (const message of throttled) {
        this.#logger.debug({ event: "STREAM_MESSAGE_RECEIVED", owner: provider.owner });
        if (attemptController.signal.aborted) return;
        releasePermit();
        await this.#updateProviderInventory(provider, message);
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

  async #updateProviderInventory(provider: ChainProviderWithOfflineSince, cluster: ClusterState): Promise<void> {
    const cached = this.#lastInventoryPerProvider.get(provider.owner);

    if (!this.#onlineStatePerProvider.get(provider.owner)) {
      try {
        this.#markProviderOnline(provider.owner);
        await this.#dbDriver.transaction(async () => {
          await Promise.all([this.#inventoryRepo.markAsOnline(provider.owner), this.#incidentsRepo.closeIncident(provider.owner)]);
        });
        this.#logger.info({ event: "PROVIDER_MARKED_ONLINE", owner: provider.owner });
      } catch (error) {
        this.#markProviderOffline(provider.owner);
        this.#logger.error({ event: "CLOSE_INCIDENT_ERROR", owner: provider.owner, error });
      }
    }

    if (cached && isEqualClusterState(cached, cluster)) {
      this.#logger.debug({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL", owner: provider.owner });
      providerInventoryStreamUpdates.add(1, { result: "noop" });
      return;
    }

    try {
      await this.#inventoryRepo.updateInventory(provider, cluster);
      this.#logger.debug({ event: "PROVIDER_INVENTORY_UPDATED", owner: provider.owner });
      this.#lastInventoryPerProvider.set(provider.owner, cluster);
      providerInventoryStreamUpdates.add(1, { result: "updated" });
    } catch (error) {
      this.#logger.error({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: provider.owner, error });
      providerInventoryStreamUpdates.add(1, { result: "error" });
    }
  }

  async #tryMarkOffline(owner: string): Promise<void> {
    if (this.#onlineStatePerProvider.get(owner) === false) {
      await this.#timer.immediate();
      return;
    }
    try {
      const isMarkedAsOffline = await this.#offlineDataloader.load({ owner, requestedAt: new Date() });
      if (isMarkedAsOffline) {
        this.#markProviderOffline(owner);
        this.#logger.info({ event: "PROVIDER_MARKED_OFFLINE", owner });
      }
    } catch (error) {
      this.#logger.error({ event: "MARK_OFFLINE_ERROR", owner, error });
    }
  }

  /**
   * Online-state mutations funnel through these three helpers so the gauge is emitted in lockstep with
   * the change and `#onlineProvidersCount` always equals the number of `true` entries in the map.
   */
  #markProviderOnline(owner: string): void {
    if (this.#onlineStatePerProvider.get(owner) === true) return;
    this.#onlineStatePerProvider.set(owner, true);
    this.#onlineProvidersCount++;
    providersGauge.record(this.#onlineProvidersCount, { state: "online" });
  }

  #markProviderOffline(owner: string): void {
    if (this.#onlineStatePerProvider.get(owner) === true) {
      this.#onlineProvidersCount--;
      providersGauge.record(this.#onlineProvidersCount, { state: "online" });
    }
    this.#onlineStatePerProvider.set(owner, false);
  }

  #forgetProviderState(owner: string): void {
    if (this.#onlineStatePerProvider.get(owner) === true) {
      this.#onlineProvidersCount--;
      providersGauge.record(this.#onlineProvidersCount, { state: "online" });
    }
    this.#onlineStatePerProvider.delete(owner);
  }

  /**
   * `monitored` mirrors the active-stream registry (streams open or retrying). `Map.size` is O(1) and
   * always exact, so we emit it directly at every registry mutation instead of keeping a counter.
   */
  #recordMonitoredCount(): void {
    providersGauge.record(this.#activeStreams.size, { state: "monitored" });
  }

  shutdown(): void {
    for (const [owner, stream] of this.#activeStreams) {
      stream.controller.abort();
      this.#logger.info({ event: "STREAM_CLOSED", owner });
    }
    this.#activeStreams.clear();
    this.#lastInventoryPerProvider.clear();
    this.#onlineStatePerProvider.clear();
    this.#onlineProvidersCount = 0;
    this.#recordMonitoredCount();
    providersGauge.record(0, { state: "online" });
    this.#isShutDown = true;
  }

  dispose(): void {
    this.shutdown();
  }
}
