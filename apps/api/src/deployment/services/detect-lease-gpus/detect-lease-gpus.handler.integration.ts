import { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DetectLeaseGpus, detectLeaseGpusKeyFor } from "@src/deployment/services/lease-gpu-detection-job/lease-gpu-detection-job.service";
import { LeaseGpuProbeService } from "@src/deployment/services/lease-gpu-probe/lease-gpu-probe.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { DetectLeaseGpusHandler } from "./detect-lease-gpus.handler";

import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

type LeaseStatus = Awaited<ReturnType<ProviderService["getLeaseStatus"]>>;

const PROVIDER = "akash1provider";
const GPU_READING = {
  source: "nvidia-smi" as const,
  driverVersion: "550.54.15",
  gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }]
};

const jobWorkers = useJobWorkers(() => [container.resolve(DetectLeaseGpusHandler)]);

describe(DetectLeaseGpusHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records the gpus a lease is running, run the way a worker runs it", async () => {
    const { walletId, dseq, singletonKey, enqueue, startWorkers, findRows } = await setup({});

    await enqueue();
    await startWorkers();

    await expectJobCompleted(DetectLeaseGpus[JOB_NAME], { singletonKey });
    const rows = await findRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dseq, gseq: 1, oseq: 1, provider: PROVIDER, service: "web", source: "nvidia-smi", driverVersion: "550.54.15" });
    expect(rows[0].gpus).toEqual(GPU_READING.gpus);
    expect(walletId).toBeGreaterThan(0);
  });

  it("replaces the previous reading when it runs again", async () => {
    const { enqueue, startWorkers, findRows, handler, payload, singletonKey } = await setup({});

    await enqueue();
    await startWorkers();
    await expectJobCompleted(DetectLeaseGpus[JOB_NAME], { singletonKey });

    await handler.handle(payload);

    await expect(findRows()).resolves.toHaveLength(1);
  });

  it("records nothing while the feature is off", async () => {
    const { enqueue, startWorkers, findRows, singletonKey } = await setup({ enabled: false });

    await enqueue();
    await startWorkers();

    await expectJobCompleted(DetectLeaseGpus[JOB_NAME], { singletonKey });
    await expect(findRows()).resolves.toEqual([]);
  });

  it("comes back for a service it could not read", async () => {
    const { enqueue, startWorkers, singletonKey } = await setup({ probeResult: { status: "idle_timeout" } });

    await enqueue();
    await startWorkers();

    await expectJobCompleted(DetectLeaseGpus[JOB_NAME], { singletonKey, state: "completed" });
    const queued = await findJobRows(DetectLeaseGpus[JOB_NAME], { singletonKey });
    expect(queued.some(job => job.state === "created")).toBe(true);
  });

  it("comes back rather than failing the job when the chain cannot be read", async () => {
    const { enqueue, startWorkers, singletonKey } = await setup({ chainFails: true });

    await enqueue();
    await startWorkers();

    await expectJobCompleted(DetectLeaseGpus[JOB_NAME], { singletonKey, state: "completed" });
    const queued = await findJobRows(DetectLeaseGpus[JOB_NAME], { singletonKey });
    expect(queued.some(job => job.state === "created")).toBe(true);
  });

  it("does not come back once every service has answered", async () => {
    const { enqueue, startWorkers, singletonKey } = await setup({});

    await enqueue();
    await startWorkers();

    await expectJobCompleted(DetectLeaseGpus[JOB_NAME], { singletonKey });
    const queued = await findJobRows(DetectLeaseGpus[JOB_NAME], { singletonKey });
    expect(queued.some(job => job.state === "created")).toBe(false);
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(container.resolve(DetectLeaseGpusHandler).requiresPermission()).toEqual([]);
  });

  async function setup(input: { enabled?: boolean; chainFails?: boolean; probeResult?: Awaited<ReturnType<LeaseGpuProbeService["probe"]>> }) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const leaseGpusTable = resolveTable("LeaseGpus");
    const { user, wallet, address } = await seedUserWithWallet();
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: user.id, dseq, sdl: null });

    const config = container.resolve(DeploymentConfigService);
    const readConfig = config.get.bind(config);
    vi.spyOn(config, "get").mockImplementation((key: Parameters<typeof readConfig>[0]) =>
      key === "LEASE_GPU_DETECTION_ENABLED" ? (input.enabled === false ? "false" : "true") : readConfig(key)
    );

    vi.spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq").mockImplementation(async () => {
      if (input.chainFails) throw new Error("chain node unreachable");

      return {
        groups: [{ id: { gseq: 1 }, group_spec: { name: "dcloud", resources: [{ resource: { gpu: { units: { val: "1" } } } }] } }]
      } as Awaited<ReturnType<DeploymentHttpService["findByOwnerAndDseq"]>>;
    });

    vi.spyOn(container.resolve(LeaseHttpService), "list").mockImplementation(
      async ({ state }) =>
        ({
          leases: state === "active" ? [{ lease: { id: { owner: address, dseq, gseq: 1, oseq: 1, provider: PROVIDER } } }] : []
        }) as Awaited<ReturnType<LeaseHttpService["list"]>>
    );

    vi.spyOn(container.resolve(ProviderRepository), "findActiveByAddress").mockResolvedValue({
      hostUri: "https://provider.example:8443"
    } as Awaited<ReturnType<ProviderRepository["findActiveByAddress"]>>);

    const providerService = container.resolve(ProviderService);
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue({ token: "jwt" } as Awaited<ReturnType<ProviderService["toProviderAuth"]>>);
    vi.spyOn(providerService, "getLeaseStatus").mockResolvedValue(
      mock<LeaseStatus>({ services: { web: mock<LeaseStatus["services"][string]>({ available: 1, total: 1 }) } })
    );

    vi.spyOn(container.resolve(LeaseGpuProbeService), "probe").mockResolvedValue(input.probeResult ?? { status: "detected", reading: GPU_READING });

    const payload = { walletId: wallet.id, dseq, attempt: 1, leaseCreatedAt: new Date().toISOString(), version: 1 as const };
    const singletonKey = detectLeaseGpusKeyFor({ walletId: wallet.id, dseq });
    const { enqueue, startWorkers } = await jobWorkers();

    return {
      handler: container.resolve(DetectLeaseGpusHandler),
      payload,
      walletId: wallet.id,
      dseq,
      singletonKey,
      enqueue: () => enqueue(new DetectLeaseGpus({ walletId: wallet.id, dseq, attempt: 1, leaseCreatedAt: new Date().toISOString() }), { singletonKey }),
      startWorkers,
      findRows: async () =>
        await db
          .select()
          .from(leaseGpusTable)
          .where(and(eq(leaseGpusTable.userId, user.id), eq(leaseGpusTable.dseq, dseq)))
    };
  }
});
