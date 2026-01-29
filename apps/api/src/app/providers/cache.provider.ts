import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";

const logger = createOtelLogger({ context: "CacheWarmup" });

container.register(APP_INITIALIZER, {
  useValue: {
    async [ON_APP_START]() {
      try {
        const controller = container.resolve(ProviderController);
        await controller.getProviderListGzipped("all");
        logger.info({ event: "PROVIDER_CACHE_WARMED" });
      } catch (error) {
        logger.error({ event: "PROVIDER_CACHE_WARMUP_FAILED", error });
      }
    }
  } satisfies AppInitializer
});
