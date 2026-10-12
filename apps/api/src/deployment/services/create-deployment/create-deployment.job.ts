import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";
import type { AcceptedDeploymentCreate } from "@src/deployment/services/deployment-writer/deployment-writer.service";

/** Creates on chain a deployment a user asked to create in the background, and settles the activity the request opened for it. */
export class CreateDeployment implements Job {
  static readonly [JOB_NAME] = "CreateDeployment";
  readonly name = CreateDeployment[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: AcceptedDeploymentCreate & { activityId: string }) {}
}

export function createDeploymentKeyFor({ userId, dseq }: { userId: string; dseq: string }): string {
  return `createDeployment.${userId}.${dseq}`;
}

/** Six retries backing off from 30 s to a 5 min cap end inside the compensation's default hour even when every attempt waits out the signer, which refuses to send past it. */
export const CREATE_DEPLOYMENT_RETRY_OPTIONS = {
  retryLimit: 6,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;
