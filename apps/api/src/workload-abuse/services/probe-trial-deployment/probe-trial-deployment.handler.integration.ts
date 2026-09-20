import "@src/app/providers/jobs.provider";

import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { WorkloadProbeEvidenceRepository } from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import { type ProbeReport, TrialWorkloadProbeService } from "@src/workload-abuse/services/trial-workload-probe/trial-workload-probe.service";
import { ProbeTrialDeployment, probeTrialDeploymentKeyFor } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ProbeTrialDeploymentHandler } from "./probe-trial-deployment.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const MAX_ATTEMPTS = 30;

const ACCELERATED_EVIDENCE = "--accel\nGPU-0001, NVIDIA A100, 95, 20480, 24576\nGPU-0001, 1234, python3, 18000";

const ISOLATED_ACCELERATED_EVIDENCE = [
  "--accel",
  "GPU-0001, NVIDIA A100, 95, 20480, 24576",
  "GPU-0001, 1234, python3, 18000",
  "--netl",
  "      2 listen=22",
  "--disk",
  "4194304 /opt/worker"
].join("\n");

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

  it("records evidence for every probed service on a clean probe", async () => {
    const { probeDeployment, findEvidence } = await setup({ verdict: "clean" });

    await probeDeployment();

    expect(await findEvidence()).toMatchObject([
      {
        verdict: "clean",
        shellStatus: "completed",
        detectionId: null,
        provider: "akash1provider",
        service: "ssh",
        accelerator: [{ name: "NVIDIA A100", utilPct: 95, memUsedMb: 20480, memTotalMb: 24576, processes: [{ pid: 1234, name: "python3", vramMb: 18000 }] }],
        artifacts: null,
        processOrigins: null,
        netShape: null
      }
    ]);
  });

  it("links the evidence rows to the detection the probe recorded", async () => {
    const { probeDeployment, findDetections, findEvidence } = await setup({ verdict: "hard" });

    await probeDeployment();

    const [detection] = await findDetections();
    expect(await findEvidence()).toMatchObject([{ verdict: "hard", detectionId: detection.id }]);
  });

  it("records no evidence when the deployment has no live lease", async () => {
    const { probeDeployment, findEvidence } = await setup({ verdict: "clean", probeStatus: "no_live_lease" });

    await probeDeployment();

    expect(await findEvidence()).toHaveLength(0);
  });

  it("records the behavioural signals on the row once the signals are enabled", async () => {
    const { probeDeployment, findEvidence } = await setup({
      verdict: "clean",
      behaviouralSignalsEnabled: true,
      shellEvidence: [{ service: "ssh", provider: "akash1provider", status: "completed", evidence: ISOLATED_ACCELERATED_EVIDENCE }]
    });

    await probeDeployment();

    const [evidence] = await findEvidence();
    expect(evidence.behaviouralFindings).toEqual([
      { signal: "accel_without_artifacts", detail: { heaviestVramMb: 18000, largestArtifactMb: 4 } },
      { signal: "network_isolated", detail: { excludedRelay: 0, listenPorts: 1 } }
    ]);
  });

  it("leaves the row without findings while the signals are disabled", async () => {
    const { probeDeployment, findEvidence } = await setup({
      verdict: "clean",
      shellEvidence: [{ service: "ssh", provider: "akash1provider", status: "completed", evidence: ISOLATED_ACCELERATED_EVIDENCE }]
    });

    await probeDeployment();

    const [evidence] = await findEvidence();
    expect(evidence.behaviouralFindings).toBeNull();
  });

  it("records nothing more for a deployment already judged abusive", async () => {
    const { probeDeployment, findDetections, probe, seedExistingDetection } = await setup({ verdict: "hard" });
    await seedExistingDetection();

    await probeDeployment();

    expect(probe).not.toHaveBeenCalled();
    expect(await findDetections()).toHaveLength(1);
  });

  async function setup(input: {
    verdict: ProbeReport["verdict"];
    attempt?: number;
    isTrialing?: boolean;
    probeStatus?: ProbeReport["probeStatus"];
    shellEvidence?: ProbeReport["shellEvidence"];
    behaviouralSignalsEnabled?: boolean;
  }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const detectionRepository = container.resolve(WorkloadAbuseDetectionRepository);
    const evidenceRepository = container.resolve(WorkloadProbeEvidenceRepository);
    const { user, wallet, address } = await seedUserWithWallet({ isTrialing: input.isTrialing ?? true });
    const dseq = createDseq();

    const config = container.resolve(WorkloadAbuseConfigService);
    const readConfig = config.get.bind(config);
    const overrides: Record<string, unknown> = {
      WORKLOAD_ABUSE_PROBE_ENABLED: true,
      WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED: input.behaviouralSignalsEnabled ?? false
    };
    vi.spyOn(config, "get").mockImplementation((key => (key in overrides ? overrides[key] : readConfig(key))) as typeof config.get);

    const probe = vi.spyOn(container.resolve(TrialWorkloadProbeService), "probe").mockResolvedValue({
      verdict: input.verdict,
      probeStatus: input.probeStatus ?? "probed",
      signals: [],
      excerpt: "denied",
      leases: [],
      shellEvidence: input.shellEvidence ?? [{ service: "ssh", provider: "akash1provider", status: "completed", evidence: ACCELERATED_EVIDENCE }]
    });

    const probeKey = probeTrialDeploymentKeyFor({ walletId: wallet.id, dseq });

    return {
      dseq,
      probe,
      findDetections: () => detectionRepository.find({ walletId: wallet.id, dseq }),
      findEvidence: () => evidenceRepository.find({ walletId: wallet.id, dseq }),
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
