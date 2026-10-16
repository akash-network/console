import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { subMinutes } from "date-fns";
import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type JobHandler, type JobPayload, type JobPermissions, JobQueueService } from "@src/core";
import { ApplyDeploymentUpdate } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.job";
import { notAppliedUpdateActivityOf, undeliveredUpdateActivityOf } from "@src/deployment/utils/update-activity/update-activity";
import { RECONCILE_DEPLOYMENT_UPDATE_DELAY_IN_MIN, ReconcileDeploymentUpdate, reconcileDeploymentUpdateOptionsFor } from "./reconcile-deployment-update.job";

@singleton()
export class ReconcileDeploymentUpdateHandler implements JobHandler<ReconcileDeploymentUpdate> {
  public readonly accepts = ReconcileDeploymentUpdate;

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

  /** The deployment is read only once nothing the update job sent can still land, so the version found is the one the deployment keeps. */
  async handle({ version: _version, ...data }: JobPayload<ReconcileDeploymentUpdate>): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    if (await this.#mayUpdateStillLand(data.updateJobId)) {
      await this.jobQueueService.enqueue(new ReconcileDeploymentUpdate(data), reconcileDeploymentUpdateOptionsFor(data.activityId, new Date()));
      return;
    }

    const runsTheUpdate = (await this.#chainVersionOf(data)) === data.manifestVersion;
    await this.activityService.settle(data.activityId, runsTheUpdate ? undeliveredUpdateActivityOf(data) : notAppliedUpdateActivityOf(data));
  }

  async #mayUpdateStillLand(updateJobId?: string): Promise<boolean> {
    if (!updateJobId) return false;

    const updateJob = await this.jobQueueService.findJob(ApplyDeploymentUpdate, updateJobId);
    if (!updateJob) return false;

    return !updateJob.completedOn || updateJob.completedOn > subMinutes(new Date(), RECONCILE_DEPLOYMENT_UPDATE_DELAY_IN_MIN);
  }

  async #chainVersionOf({ owner, dseq }: ReconcileDeploymentUpdate["data"]): Promise<string> {
    const response = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);
    if ("code" in response) throw new Error(`Deployment ${dseq} could not be read: ${response.message}`);

    return response.deployment.hash;
  }
}
