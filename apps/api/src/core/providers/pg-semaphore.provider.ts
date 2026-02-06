import postgres from "postgres";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import { SemaphoreFactory } from "@src/core/lib/pg-semaphore";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { CORE_CONFIG } from "@src/core/providers/config.provider";

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(CORE_CONFIG);
    const client = postgres(config.POSTGRES_DB_URI, {
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10
    });
    c.resolve(DisposableRegistry).register({ dispose: () => client.end() });
    SemaphoreFactory.configure(client);

    return {
      [ON_APP_START]: async () => {}
    };
  })
});
