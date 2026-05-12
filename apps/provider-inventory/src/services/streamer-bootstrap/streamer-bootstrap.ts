import type { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";

export async function runStreamerBootstrap(writer: ProviderInventoryRepository, scheduler: DiscoverySchedulerService): Promise<void> {
  await writer.resetOnlineSince();
  scheduler.start();
}
