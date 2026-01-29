import { container } from "tsyringe";

import { WalletBalanceReloadCheckHandler } from "@src/billing/services/wallet-balance-reload-check/wallet-balance-reload-check.handler";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { NotificationHandler } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseBlockedUserDeploymentsHandler } from "../services/close-blocked-user-deployments/close-blocked-user-deployments.handler";
import { CloseTrialDeploymentHandler } from "../services/close-trial-deployment/close-trial-deployment.handler";
import { TrialDeploymentLeaseCreatedHandler } from "../services/trial-deployment-lease-created/trial-deployment-lease-created.handler";
import { TrialStartedHandler } from "../services/trial-started/trial-started.handler";

container.register(APP_INITIALIZER, {
  useValue: {
    async [ON_APP_START]() {
      const jobQueueManager = container.resolve(JobQueueService);
      await jobQueueManager.setup();
      await jobQueueManager.registerHandlers([
        container.resolve(TrialStartedHandler),
        container.resolve(NotificationHandler),
        container.resolve(CloseTrialDeploymentHandler),
        container.resolve(CloseBlockedUserDeploymentsHandler),
        container.resolve(TrialDeploymentLeaseCreatedHandler),
        container.resolve(WalletBalanceReloadCheckHandler)
      ]);
    }
  } satisfies AppInitializer
});
