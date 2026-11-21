import { type Job, JOB_NAME } from "@src/core";

export class WatchGpuWaitlists implements Job {
  static readonly [JOB_NAME] = "WatchGpuWaitlists";
  readonly name = WatchGpuWaitlists[JOB_NAME];
  readonly version = 1;
  readonly data: Record<string, never> = {};
}
