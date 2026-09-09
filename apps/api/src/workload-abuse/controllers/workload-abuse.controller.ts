import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { TrialAbuseEnforcementJobService } from "@src/workload-abuse/services/trial-abuse-enforcement-job/trial-abuse-enforcement-job.service";
import { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";

@singleton()
export class WorkloadAbuseController {
  constructor(
    private readonly probeJobService: TrialWorkloadProbeJobService,
    private readonly enforcementJobService: TrialAbuseEnforcementJobService
  ) {}

  async probeTrialDeployments(options: DryRunOptions): Promise<void> {
    await this.probeJobService.reconcile(options);
    await this.enforcementJobService.reconcile(options);
  }
}
