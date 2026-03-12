/* v8 ignore start */
import blockedAt from "blocked-at";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import type { AppInitializer } from "./app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "./app-initializer";
import { CORE_CONFIG } from "./config.provider";
import { LoggerService } from "./logging.provider";

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(
    DisposableRegistry.registerFromFactory<AppInitializer>(c => {
      const logger = c.resolve(LoggerService);
      let disposable: ReturnType<typeof blockedAt> | null = null;
      return {
        async [ON_APP_START]() {
          if (!c.resolve(CORE_CONFIG).EVENTLOOP_MONITORING_ENABLED) return;

          disposable = blockedAt(
            (timeSpent, stack) => {
              logger.warn({
                event: "EVENT_LOOP_LONG_EXECUTION",
                timeSpent,
                stack
              });
            },
            {
              threshold: 100
            }
          );
        },
        dispose() {
          disposable?.stop();
        }
      };
    })
  )
});
