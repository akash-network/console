import { subMinutes } from "date-fns";
import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type JobHandler, type JobPayload, type JobPermissions, JobQueueService } from "@src/core";
import { CreateDeployment } from "@src/deployment/services/create-deployment/create-deployment.job";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { createdActivityOf, notCreatedActivityOf } from "@src/deployment/utils/create-activity/create-activity";
import { RECONCILE_DEPLOYMENT_CREATE_DELAY_IN_MIN, ReconcileDeploymentCreate, reconcileDeploymentCreateOptionsFor } from "./reconcile-deployment-create.job";

@singleton()
export class ReconcileDeploymentCreateHandler implements JobHandler<ReconcileDeploymentCreate> {
  public readonly accepts = ReconcileDeploymentCreate;

  /** One waiting check per activity, so a run retried after it already queued the next check queues no second one. */
  public readonly policy = "short";

  constructor(
    private readonly activityService: ActivityService,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentWriterService: DeploymentWriterService
  ) {}

  /** Adopting a deployment found created reads the user's wallet, as the create itself would have. */
  requiresPermission({ userId }: JobPayload<ReconcileDeploymentCreate>): JobPermissions {
    return [{ action: "sign", subject: "UserWallet", conditions: { userId } }];
  }

  /** The chain is read only once nothing the create job sent can still land, so a deployment found missing is one the create will never make. */
  async handle({ version: _version, ...data }: JobPayload<ReconcileDeploymentCreate>): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    if (await this.#mayCreateStillLand(data.createJobId)) {
      await this.jobQueueService.enqueue(new ReconcileDeploymentCreate(data), reconcileDeploymentCreateOptionsFor(data.activityId, new Date()));
      return;
    }

    const { activityId, createJobId: _createJobId, ...accepted } = data;
    const isCreated = await this.deploymentWriterService.reconcileCreate(accepted);
    await this.activityService.settle(activityId, isCreated ? createdActivityOf(accepted) : notCreatedActivityOf(accepted));
  }

  async #mayCreateStillLand(createJobId?: string): Promise<boolean> {
    if (!createJobId) return false;

    const createJob = await this.jobQueueService.findJob(CreateDeployment, createJobId);
    if (!createJob) return false;

    return !createJob.completedOn || createJob.completedOn > subMinutes(new Date(), RECONCILE_DEPLOYMENT_CREATE_DELAY_IN_MIN);
  }
}
