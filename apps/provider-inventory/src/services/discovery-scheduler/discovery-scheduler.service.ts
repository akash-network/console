import { createOtelLogger } from "@akashnetwork/logging/otel";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";

@singleton()
export class DiscoverySchedulerService {
  private readonly logger = createOtelLogger({ context: "DiscoveryScheduler" });
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    @inject(ChainProviderPollerService) private readonly poller: ChainProviderPollerService,
    @inject(StreamLifecycleManagerService) private readonly lifecycle: StreamLifecycleManagerService,
    @inject(APP_CONFIG) private readonly config: EnvConfig
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    try {
      this.logger.info({ event: "DISCOVERY_TICK_START" });
      const providers = await this.poller.poll();
      this.lifecycle.reconcile(providers);
      this.logger.info({ event: "DISCOVERY_TICK_COMPLETE", providerCount: providers.length });
    } catch (error) {
      this.logger.error({ event: "DISCOVERY_TICK_ERROR", error });
    }

    if (this.running) {
      this.timer = setTimeout(() => void this.tick(), this.config.DISCOVERY_INTERVAL_MS);
    }
  }
}
