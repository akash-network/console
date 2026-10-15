import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Files a deployment's alerts into the project it moved to, enqueued in the transaction that moves it. */
export class MoveDeploymentAlertsJob implements Job {
  static readonly [JOB_NAME] = "MoveDeploymentAlertsJob";
  readonly name = MoveDeploymentAlertsJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { organizationId: string; dseq: string }) {}
}

/** Long enough to outlast a notifications outage of a few hours, since the alerts stay with the old project's members until it runs. */
export const MOVE_DEPLOYMENT_ALERTS_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 60 * 60
} satisfies EnqueueOptions;
