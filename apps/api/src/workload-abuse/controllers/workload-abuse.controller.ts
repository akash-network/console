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

  /** Each sweep runs whether or not the other fails, so a probe outage does not leave stuck wipes waiting another run. */
  async probeTrialDeployments(options: DryRunOptions): Promise<void> {
    const sweeps = await Promise.allSettled([this.probeJobService.reconcile(options), this.enforcementJobService.reconcile(options)]);
    const failure = sweeps.find((sweep): sweep is PromiseRejectedResult => sweep.status === "rejected");

    if (failure) throw failure.reason;
  }
}
