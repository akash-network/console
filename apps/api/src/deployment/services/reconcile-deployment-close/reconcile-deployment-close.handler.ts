import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { subMinutes } from "date-fns";
import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type JobHandler, type JobPayload, type JobPermissions, JobQueueService } from "@src/core";
import { CloseDeployment } from "@src/deployment/services/close-deployment/close-deployment.job";
import { closedActivityOf, stillOpenActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { RECONCILE_DEPLOYMENT_CLOSE_DELAY_IN_MIN, ReconcileDeploymentClose, reconcileDeploymentCloseOptionsFor } from "./reconcile-deployment-close.job";

@singleton()
export class ReconcileDeploymentCloseHandler implements JobHandler<ReconcileDeploymentClose> {
  public readonly accepts = ReconcileDeploymentClose;

  /** One waiting check per activity, so a run retried after it already queued the next check queues no second one. */
  public readonly policy = "short";

  constructor(
    private readonly activityService: ActivityService,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentHttpService: DeploymentHttpService
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  /** The deployment is read only once nothing the close job sent can still land, so a deployment found open is one the close will never reach. */
  async handle({ version: _version, ...data }: JobPayload<ReconcileDeploymentClose>): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    if (await this.#mayCloseStillLand(data.closeJobId)) {
      await this.jobQueueService.enqueue(new ReconcileDeploymentClose(data), reconcileDeploymentCloseOptionsFor(data.activityId, new Date()));
      return;
    }

    const isClosed = await this.#isClosed(data);
    await this.activityService.settle(data.activityId, isClosed ? closedActivityOf(data) : stillOpenActivityOf(data));
  }

  async #mayCloseStillLand(closeJobId: string): Promise<boolean> {
    const closeJob = await this.jobQueueService.findJob(CloseDeployment, closeJobId);
    if (!closeJob) return false;

    return !closeJob.completedOn || closeJob.completedOn > subMinutes(new Date(), RECONCILE_DEPLOYMENT_CLOSE_DELAY_IN_MIN);
  }

  async #isClosed({ owner, dseq }: ReconcileDeploymentClose["data"]): Promise<boolean> {
    const response = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);
    if ("code" in response) throw new Error(`Deployment ${dseq} could not be read: ${response.message}`);

    return response.deployment.state === "closed";
  }
}
