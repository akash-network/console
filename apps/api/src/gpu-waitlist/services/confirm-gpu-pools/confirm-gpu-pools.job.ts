import { type Job, JOB_NAME } from "@src/core";

export const CONFIRM_GPU_POOLS_KEY = "confirmGpuPools";

export class ConfirmGpuPools implements Job {
  static readonly [JOB_NAME] = "ConfirmGpuPools";
  readonly name = ConfirmGpuPools[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { poolKeys: string[] }) {}
}
