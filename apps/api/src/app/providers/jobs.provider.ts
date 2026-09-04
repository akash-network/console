import { container } from "tsyringe";

import { ActivateTrialHandler } from "@src/billing/services/activate-trial/activate-trial.handler";
import { WalletBalanceReloadCheckHandler } from "@src/billing/services/wallet-balance-reload-check/wallet-balance-reload-check.handler";
import { WalletCreditsLowCheckHandler } from "@src/billing/services/wallet-credits-low-check/wallet-credits-low-check.handler";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { DeleteUnbackedDeploymentSettingHandler } from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { ReconcileManagedTxHandler } from "@src/deployment/services/reconcile-managed-tx/reconcile-managed-tx.handler";
import { RecordDeploymentSettingHandler } from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { NotificationHandler } from "@src/notifications/services/notification-handler/notification.handler";
import { AutoRechargeSucceededHandler } from "../services/auto-recharge-succeeded/auto-recharge-succeeded.handler";
import { CloseExpiredDeploymentHandler } from "../services/close-expired-deployment/close-expired-deployment.handler";
import { CloseTrialDeploymentHandler } from "../services/close-trial-deployment/close-trial-deployment.handler";
import { CloseUnreachableProviderDeploymentHandler } from "../services/close-unreachable-provider-deployment/close-unreachable-provider-deployment.handler";
import { EnableDeploymentAlertHandler } from "../services/enable-deployment-alert/enable-deployment-alert.handler";
import { FirstPurchaseBonusGrantedHandler } from "../services/first-purchase-bonus-granted/first-purchase-bonus-granted.handler";
import { FundDeploymentHandler } from "../services/fund-deployment/fund-deployment.handler";
import { FundDrainingDeploymentsHandler } from "../services/fund-draining-deployments/fund-draining-deployments.handler";
import { TrialDeploymentLeaseCreatedHandler } from "../services/trial-deployment-lease-created/trial-deployment-lease-created.handler";
import { TrialStartedHandler } from "../services/trial-started/trial-started.handler";

/** Exported because enqueuing needs the queue to exist, and functional tests boot the app without running its initializers. */
export async function startJobQueues(): Promise<void> {
  const jobQueueManager = container.resolve(JobQueueService);
  await jobQueueManager.setup();
  await jobQueueManager.registerHandlers([
    container.resolve(TrialStartedHandler),
    container.resolve(NotificationHandler),
    container.resolve(CloseTrialDeploymentHandler),
    container.resolve(CloseExpiredDeploymentHandler),
    container.resolve(CloseUnreachableProviderDeploymentHandler),
    container.resolve(TrialDeploymentLeaseCreatedHandler),
    container.resolve(EnableDeploymentAlertHandler),
    container.resolve(FundDeploymentHandler),
    container.resolve(FundDrainingDeploymentsHandler),
    container.resolve(WalletBalanceReloadCheckHandler),
    container.resolve(WalletCreditsLowCheckHandler),
    container.resolve(FirstPurchaseBonusGrantedHandler),
    container.resolve(AutoRechargeSucceededHandler),
    container.resolve(ActivateTrialHandler),
    container.resolve(DeleteUnbackedDeploymentSettingHandler),
    container.resolve(RecordDeploymentSettingHandler),
    container.resolve(ReconcileManagedTxHandler)
  ]);
}

container.register(APP_INITIALIZER, {
  useValue: {
    [ON_APP_START]: startJobQueues
  } satisfies AppInitializer
});
