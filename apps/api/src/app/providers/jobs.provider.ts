import { container } from "tsyringe";

import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { NotificationHandler } from "@src/notifications/services/notification-handler/notification.handler";
import { TrialStartedHandler } from "../services/trial-started/trial-started.handler";

container.register(APP_INITIALIZER, {
  useValue: {
    async [ON_APP_START]() {
      const jobQueueManager = container.resolve(JobQueueService);
      await jobQueueManager.setup();
      await jobQueueManager.registerHandlers([
        // keep new lines
        container.resolve(TrialStartedHandler),
        container.resolve(NotificationHandler)
      ]);
    }
  } satisfies AppInitializer
});
