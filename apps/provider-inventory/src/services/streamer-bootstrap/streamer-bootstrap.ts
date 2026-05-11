import type { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import type { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";

export async function runStreamerBootstrap(writer: ProviderInventoryWriterService, scheduler: DiscoverySchedulerService): Promise<void> {
  await writer.resetOnlineSince();
  scheduler.start();
}
