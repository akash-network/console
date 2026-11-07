import { type Job, JOB_NAME } from "@src/core";

export class CheckTemplateDeploymentStillRunning implements Job {
  static readonly [JOB_NAME] = "CheckTemplateDeploymentStillRunning";
  readonly name = CheckTemplateDeploymentStillRunning[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { deploymentSettingId: string; walletId: number; dseq: string }) {}
}

export function checkTemplateDeploymentStillRunningKeyFor(deploymentSettingId: string): string {
  return `checkTemplateDeploymentStillRunning.${deploymentSettingId}`;
}
