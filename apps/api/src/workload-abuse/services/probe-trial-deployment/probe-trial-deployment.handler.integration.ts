import "@src/app/providers/jobs.provider";

import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { type ProbeReport, TrialWorkloadProbeService } from "@src/workload-abuse/services/trial-workload-probe/trial-workload-probe.service";
import { ProbeTrialDeployment, probeTrialDeploymentKeyFor } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ProbeTrialDeploymentHandler } from "./probe-trial-deployment.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const MAX_ATTEMPTS = 30;

const jobWorkers = useJobWorkers(() => [container.resolve(ProbeTrialDeploymentHandler)]);

describe(ProbeTrialDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a detection for a workload the probe judges abusive", async () => {
    const { dseq, probeDeployment, findDetections } = await setup({ verdict: "hard" });

    await probeDeployment();

    expect(await findDetections()).toMatchObject([{ dseq, verdict: "hard", probeStatus: "probed" }]);
  });

  it("stops probing once the verdict is hard", async () => {
    const { probeDeployment, findNextProbe } = await setup({ verdict: "hard" });

    await probeDeployment();

    expect(await findNextProbe()).toBeUndefined();
  });

  it("probes again for a workload that still looks clean", async () => {
    const { probeDeployment, findNextProbe } = await setup({ verdict: "clean" });

    await probeDeployment();

    expect((await findNextProbe())?.data).toMatchObject({ attempt: 2 });
  });

  it("stops probing at the attempt cap", async () => {
    const { probeDeployment, findNextProbe } = await setup({ verdict: "clean", attempt: MAX_ATTEMPTS });

    await probeDeployment();

    expect(await findNextProbe()).toBeUndefined();
  });

  it("probes nothing for a wallet that has left the trial", async () => {
    const { probeDeployment, findDetections, probe } = await setup({ verdict: "hard", isTrialing: false });

    await probeDeployment();

    expect(probe).not.toHaveBeenCalled();
    expect(await findDetections()).toHaveLength(0);
  });

  it("records nothing more for a deployment already judged abusive", async () => {
    const { probeDeployment, findDetections, probe, seedExistingDetection } = await setup({ verdict: "hard" });
    await seedExistingDetection();

    await probeDeployment();

    expect(probe).not.toHaveBeenCalled();
    expect(await findDetections()).toHaveLength(1);
  });

  async function setup(input: { verdict: ProbeReport["verdict"]; attempt?: number; isTrialing?: boolean }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const detectionRepository = container.resolve(WorkloadAbuseDetectionRepository);
    const { user, wallet, address } = await seedUserWithWallet({ isTrialing: input.isTrialing ?? true });
    const dseq = createDseq();

    const config = container.resolve(WorkloadAbuseConfigService);
    const readConfig = config.get.bind(config);
    vi.spyOn(config, "get").mockImplementation((key => (key === "WORKLOAD_ABUSE_PROBE_ENABLED" ? true : readConfig(key))) as typeof config.get);

    const probe = vi.spyOn(container.resolve(TrialWorkloadProbeService), "probe").mockResolvedValue({
      verdict: input.verdict,
      probeStatus: "probed",
      signals: [],
      excerpt: "denied",
      leases: []
    });

    const probeKey = probeTrialDeploymentKeyFor({ walletId: wallet.id, dseq });

    return {
      dseq,
      probe,
      findDetections: () => detectionRepository.find({ walletId: wallet.id, dseq }),
      seedExistingDetection: () =>
        detectionRepository.create({
          userId: user.id,
          walletId: wallet.id,
          dseq,
          provider: address,
          verdict: "hard",
          probeStatus: "probed",
          signals: [],
          evidenceExcerpt: "denied"
        }),
      findNextProbe: async () => (await findJobRows<{ attempt: number }>(ProbeTrialDeployment[JOB_NAME], { singletonKey: probeKey, state: "created" }))[0],
      probeDeployment: async () => {
        await enqueue(new ProbeTrialDeployment({ walletId: wallet.id, dseq, attempt: input.attempt ?? 1, leaseCreatedAt: new Date().toISOString() }), {
          singletonKey: probeKey
        });
        await startWorkers();
        await expectJobCompleted(ProbeTrialDeployment[JOB_NAME], { singletonKey: probeKey, state: "completed" });
      }
    };
  }
});
