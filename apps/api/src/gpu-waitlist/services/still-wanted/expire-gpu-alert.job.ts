import { type Job, JOB_NAME } from "@src/core";

export class ExpireGpuAlert implements Job {
  static readonly [JOB_NAME] = "ExpireGpuAlert";
  readonly name = ExpireGpuAlert[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { entryId: string }) {}
}
