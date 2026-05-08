import { createOtelLogger } from "@akashnetwork/logging/otel";
import { inject, singleton } from "tsyringe";

import { projectRow } from "@src/lib/project-row/project-row";
import { reduceAttributes } from "@src/lib/reduce-attributes/reduce-attributes";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import { PROVIDER_STREAM_FACTORY } from "@src/providers/provider-stream.provider";
import { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class StreamLifecycleManagerService {
  private readonly logger = createOtelLogger({ context: "StreamLifecycleManager" });
  private readonly activeStreams = new Map<string, AbortController>();

  constructor(
    @inject(PROVIDER_STREAM_FACTORY) private readonly streamFactory: ProviderStreamFactory,
    @inject(ProviderInventoryWriterService) private readonly writer: ProviderInventoryWriterService
  ) {}

  reconcile(providers: ChainProvider[]): void {
    for (const provider of providers) {
      if (this.activeStreams.has(provider.owner)) continue;
      this.startStream(provider);
    }
  }

  private startStream(provider: ChainProvider): void {
    const controller = new AbortController();
    this.activeStreams.set(provider.owner, controller);
    void this.runStream(provider, controller.signal);
  }

  private async runStream(provider: ChainProvider, signal: AbortSignal): Promise<void> {
    try {
      const attributes = reduceAttributes(provider.selfAttributes, provider.signedAttributes);
      const stream = this.streamFactory.openStatusStream(provider.hostUri, signal);

      for await (const message of stream) {
        if (signal.aborted) break;
        const row = projectRow(message);
        await this.writer.upsertProvider(provider.owner, provider, row, attributes);
      }
    } catch (error) {
      if (!signal.aborted) {
        this.logger.error({ event: "STREAM_ERROR", owner: provider.owner, error });
      }
    } finally {
      this.activeStreams.delete(provider.owner);
    }
  }

  shutdown(): void {
    for (const [owner, controller] of this.activeStreams) {
      controller.abort();
      this.logger.info({ event: "STREAM_CLOSED", owner });
    }
    this.activeStreams.clear();
  }

  dispose(): void {
    this.shutdown();
  }
}
