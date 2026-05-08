import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { projectRow } from "@src/lib/project-row/project-row";
import { reduceAttributes } from "@src/lib/reduce-attributes/reduce-attributes";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import { PROVIDER_STREAM_FACTORY } from "@src/providers/provider-stream.provider";
import { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class StreamLifecycleManagerService {
  #logger: LoggerService;
  #streamFactory: ProviderStreamFactory;
  #writer: ProviderInventoryWriterService;
  #activeStreams = new Map<string, AbortController>();

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
      const attributes = reduceAttributes(provider.selfAttributes, provider.signedAttributes);
      const stream = this.#streamFactory.openStatusStream(provider.hostUri, signal);

      for await (const message of stream) {
        if (signal.aborted) break;
        const row = projectRow(message);
        await this.#writer.upsertProvider(provider.owner, provider, row, attributes);
      }
    } catch (error) {
      if (!signal.aborted) {
        this.#logger.error({ event: "STREAM_ERROR", owner: provider.owner, error });
      }
    } finally {
      this.#activeStreams.delete(provider.owner);
    }
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
