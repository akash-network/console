import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CacheInstrumentationService } from "@src/caching/cache-instrumentation.service";
import { CachePressureMonitorService } from "@src/caching/cache-pressure-monitor.service";
import { CacheRegistry, cacheRegistry } from "@src/caching/cache-registry";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import type { AppInitializer } from "./app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "./app-initializer";
import { CORE_CONFIG } from "./config.provider";

container.register(CacheRegistry, { useValue: cacheRegistry });

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(
    DisposableRegistry.registerFromFactory<AppInitializer>(c => {
      let pressureMonitor: CachePressureMonitorService | null = null;
      return {
        async [ON_APP_START]() {
          c.resolve(CacheInstrumentationService);
          if (!c.resolve(CORE_CONFIG).CACHE_PRESSURE_MONITORING_ENABLED) return;

          pressureMonitor = c.resolve(CachePressureMonitorService);
          pressureMonitor.start();
        },
        dispose() {
          pressureMonitor?.dispose();
        }
      };
    })
  )
});
