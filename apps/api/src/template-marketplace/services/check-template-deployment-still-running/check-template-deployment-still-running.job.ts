import { type Job, JOB_NAME } from "@src/core";

export class CheckTemplateDeploymentStillRunning implements Job {
  static readonly [JOB_NAME] = "CheckTemplateDeploymentStillRunning";
  readonly name = CheckTemplateDeploymentStillRunning[JOB_NAME];
  readonly version = 1;

  /** Carries `isTrial` from the lease, because a trial that converts before the check must still count as the trial deploy it was. */
  constructor(public readonly data: { deploymentSettingId: string; walletId: number; dseq: string; isTrial: boolean }) {}
}

export function checkTemplateDeploymentStillRunningKeyFor(deploymentSettingId: string): string {
  return `checkTemplateDeploymentStillRunning.${deploymentSettingId}`;
}
