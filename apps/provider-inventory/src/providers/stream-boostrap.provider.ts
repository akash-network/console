import { container, instancePerContainerCachingFactory } from "tsyringe";

import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import { APP_INITIALIZER, ON_APP_START } from "@src/services/start-server/app-initializer";

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(c => {
    return {
      async [ON_APP_START]() {
        await c.resolve(ProviderInventoryRepository).resetOnlineSince();
        c.resolve(DiscoverySchedulerService).start();
      }
    };
  })
});
