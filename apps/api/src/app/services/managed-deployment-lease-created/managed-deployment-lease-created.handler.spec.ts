import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { LeaseGpuDetectionJobService } from "@src/deployment/services/lease-gpu-detection-job/lease-gpu-detection-job.service";
import { ManagedDeploymentLeaseCreatedHandler } from "./managed-deployment-lease-created.handler";

const PAYLOAD = { walletId: 7, dseq: "12345", createdAt: "2026-09-21T10:00:00.000Z", version: 1 as const };

describe(ManagedDeploymentLeaseCreatedHandler.name, () => {
  it("asks for the lease's gpus to be read from the moment it was created", async () => {
    const { handler, gpuDetectionJobService } = setup();

    await handler.handle(PAYLOAD);

    expect(gpuDetectionJobService.scheduleInitial).toHaveBeenCalledWith({
      walletId: 7,
      dseq: "12345",
      leaseCreatedAt: new Date("2026-09-21T10:00:00.000Z")
    });
  });

  it("swallows a scheduling failure, because the deployment does not depend on the read", async () => {
    const { handler, gpuDetectionJobService, logger } = setup();
    gpuDetectionJobService.scheduleInitial.mockRejectedValue(new Error("queue down"));

    await expect(handler.handle(PAYLOAD)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_DETECTION_SCHEDULE_FAILED", walletId: 7, dseq: "12345" }));
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(setup().handler.requiresPermission()).toEqual([]);
  });

  function setup() {
    const gpuDetectionJobService = mock<LeaseGpuDetectionJobService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const handler = new ManagedDeploymentLeaseCreatedHandler(gpuDetectionJobService, vi.fn<CreateLogger>(() => logger));

    return { handler, gpuDetectionJobService, logger };
  }
});
