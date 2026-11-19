import { type Job, JOB_NAME } from "@src/core";

export class GpuAvailableNoticeJob implements Job {
  static readonly [JOB_NAME] = "GpuAvailableNoticeJob";
  readonly name = GpuAvailableNoticeJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { entryId: string; waveNumber: number; pricePerGpuUsdPerHour: number }) {}
}
