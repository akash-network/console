import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { LeaseGpuDetectionJobService } from "@src/deployment/services/lease-gpu-detection-job/lease-gpu-detection-job.service";
import type { LeaseGpuOfferJobService } from "@src/deployment/services/lease-gpu-offer-job/lease-gpu-offer-job.service";
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

  it("asks for the gpus the lease's bid offered to be recorded", async () => {
    const { handler, gpuOfferJobService } = setup();

    await handler.handle(PAYLOAD);

    expect(gpuOfferJobService.schedule).toHaveBeenCalledWith({ walletId: 7, dseq: "12345" });
  });

  it("swallows a scheduling failure, because the deployment does not depend on the read", async () => {
    const { handler, gpuDetectionJobService, logger } = setup();
    gpuDetectionJobService.scheduleInitial.mockRejectedValue(new Error("queue down"));

    await expect(handler.handle(PAYLOAD)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_DETECTION_SCHEDULE_FAILED", walletId: 7, dseq: "12345" }));
  });

  it("still asks for the gpus to be read when recording the offer could not be scheduled", async () => {
    const { handler, gpuDetectionJobService, gpuOfferJobService, logger } = setup();
    gpuOfferJobService.schedule.mockRejectedValue(new Error("queue down"));

    await expect(handler.handle(PAYLOAD)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_OFFERS_SCHEDULE_FAILED", walletId: 7, dseq: "12345" }));
    expect(gpuDetectionJobService.scheduleInitial).toHaveBeenCalled();
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(setup().handler.requiresPermission()).toEqual([]);
  });

  function setup() {
    const gpuDetectionJobService = mock<LeaseGpuDetectionJobService>();
    const gpuOfferJobService = mock<LeaseGpuOfferJobService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const handler = new ManagedDeploymentLeaseCreatedHandler(
      gpuDetectionJobService,
      gpuOfferJobService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { handler, gpuDetectionJobService, gpuOfferJobService, logger };
  }
});
