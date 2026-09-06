import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";

@singleton()
export class WorkloadAbuseController {
  constructor(private readonly probeJobService: TrialWorkloadProbeJobService) {}

  async probeTrialDeployments(options: DryRunOptions): Promise<void> {
    await this.probeJobService.reconcile(options);
  }
}
