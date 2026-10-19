import { type Job, JOB_NAME } from "@src/core";

export class GpuWinBackCheck implements Job {
  static readonly [JOB_NAME] = "GpuWinBackCheck";
  readonly name = GpuWinBackCheck[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userId: string }) {}
}

export function gpuWinBackCheckKeyFor(userId: string): string {
  return `gpuWinBackCheck.${userId}`;
}
