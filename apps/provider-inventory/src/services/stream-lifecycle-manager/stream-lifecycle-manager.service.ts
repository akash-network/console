import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { projectRow } from "@src/lib/project-row/project-row";
import { projectedRowsEqual } from "@src/lib/projected-row-equals/projected-row-equals";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import { PROVIDER_STREAM_FACTORY } from "@src/providers/provider-stream.provider";
import { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";

@singleton()
export class StreamLifecycleManagerService {
  readonly #logger: LoggerService;
  readonly #streamFactory: ProviderStreamFactory;
  readonly #writer: ProviderInventoryWriterService;
  readonly #activeStreams = new Map<string, AbortController>();
  readonly #lastInventoryPerProvider = new Map<string, ProjectedRow>();
  #noopMessagesSkipped = 0;

  constructor(
    @inject(PROVIDER_STREAM_FACTORY) streamFactory: ProviderStreamFactory,
    @inject(ProviderInventoryWriterService) writer: ProviderInventoryWriterService,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory
  ) {
    this.#streamFactory = streamFactory;
    this.#writer = writer;
    this.#logger = loggerFactory({ context: "StreamLifecycleManager" });
  }

  reconcile(providers: ChainProvider[]): void {
    const currentOwners = new Set(providers.map(p => p.owner));

    for (const [owner, controller] of this.#activeStreams) {
      if (!currentOwners.has(owner)) {
        controller.abort();
        this.#activeStreams.delete(owner);
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
      const stream = this.#streamFactory.openStatusStream(provider.hostUri, signal);

      for await (const message of stream) {
        if (signal.aborted) break;
        const row = projectRow(message);
        const cached = this.#lastInventoryPerProvider.get(provider.owner);
        if (cached && projectedRowsEqual(row, cached)) {
          this.#noopMessagesSkipped++;
          continue;
        }
        try {
          await this.#writer.upsertInventory(provider, row);
          this.#lastInventoryPerProvider.set(provider.owner, row);
        } catch (error) {
          this.#logger.error({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: provider.owner, error });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        this.#logger.error({ event: "STREAM_ERROR", owner: provider.owner, error });
      }
    } finally {
      if (this.#activeStreams.get(provider.owner)?.signal === signal) {
        this.#activeStreams.delete(provider.owner);
      }
    }
  }

  getStats(): { noopMessagesSkipped: number } {
    return { noopMessagesSkipped: this.#noopMessagesSkipped };
  }

  shutdown(): void {
    for (const [owner, controller] of this.#activeStreams) {
      controller.abort();
      this.#logger.info({ event: "STREAM_CLOSED", owner });
    }
    this.#activeStreams.clear();
  }

  dispose(): void {
    this.shutdown();
  }
}
