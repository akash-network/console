import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { LeaseGpuDetectionJobService } from "@src/deployment/services/lease-gpu-detection-job/lease-gpu-detection-job.service";
import { LeaseGpuOfferJobService } from "@src/deployment/services/lease-gpu-offer-job/lease-gpu-offer-job.service";

@singleton()
export class LeaseGpuController {
  constructor(
    private readonly offerJobService: LeaseGpuOfferJobService,
    private readonly detectionJobService: LeaseGpuDetectionJobService
  ) {}

  async detectLeaseGpus(options: DryRunOptions): Promise<void> {
    await this.offerJobService.reconcile(options);
    await this.detectionJobService.reconcile(options);
  }
}
