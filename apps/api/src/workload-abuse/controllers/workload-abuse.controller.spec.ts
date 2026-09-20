import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProbeEvidenceService } from "@src/workload-abuse/services/probe-evidence/probe-evidence.service";
import type { TrialAbuseEnforcementJobService } from "@src/workload-abuse/services/trial-abuse-enforcement-job/trial-abuse-enforcement-job.service";
import type { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { WorkloadAbuseController } from "./workload-abuse.controller";

describe(WorkloadAbuseController.name, () => {
  it("runs the probe sweep and the enforcement sweep with the same options", async () => {
    const { controller, probeJobService, enforcementJobService } = setup();

    await controller.probeTrialDeployments({ dryRun: true });

    expect(probeJobService.reconcile).toHaveBeenCalledWith({ dryRun: true });
    expect(enforcementJobService.reconcile).toHaveBeenCalledWith({ dryRun: true });
  });

  it("still runs the enforcement sweep when the probe sweep fails, then reports that failure", async () => {
    const { controller, probeJobService, enforcementJobService } = setup();
    const error = new Error("db down");
    probeJobService.reconcile.mockRejectedValue(error);

    await expect(controller.probeTrialDeployments({ dryRun: false })).rejects.toBe(error);

    expect(enforcementJobService.reconcile).toHaveBeenCalledWith({ dryRun: false });
  });

  it("reports both failures when both sweeps fail", async () => {
    const { controller, probeJobService, enforcementJobService } = setup();
    const probeError = new Error("probe db down");
    const enforcementError = new Error("queue down");
    probeJobService.reconcile.mockRejectedValue(probeError);
    enforcementJobService.reconcile.mockRejectedValue(enforcementError);

    await expect(controller.probeTrialDeployments({ dryRun: false })).rejects.toMatchObject({ errors: [probeError, enforcementError] });
  });

  it("purges expired evidence once the sweeps settle", async () => {
    const { controller, probeEvidenceService } = setup();

    await controller.probeTrialDeployments({ dryRun: true });

    expect(probeEvidenceService.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it("leaves the purge to the next run when a sweep fails", async () => {
    const { controller, probeJobService, probeEvidenceService } = setup();
    probeJobService.reconcile.mockRejectedValue(new Error("db down"));

    await expect(controller.probeTrialDeployments({ dryRun: false })).rejects.toThrow("db down");

    expect(probeEvidenceService.purgeExpired).not.toHaveBeenCalled();
  });

  function setup() {
    const probeJobService = mock<TrialWorkloadProbeJobService>();
    probeJobService.reconcile.mockResolvedValue();
    const enforcementJobService = mock<TrialAbuseEnforcementJobService>();
    enforcementJobService.reconcile.mockResolvedValue();
    const probeEvidenceService = mock<ProbeEvidenceService>();
    const controller = new WorkloadAbuseController(probeJobService, enforcementJobService, probeEvidenceService);

    return { controller, probeJobService, enforcementJobService, probeEvidenceService };
  }
});
