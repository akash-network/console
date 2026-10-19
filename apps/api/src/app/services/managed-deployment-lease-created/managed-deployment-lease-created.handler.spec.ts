import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GpuWinBackService } from "@src/billing/services/gpu-win-back/gpu-win-back.service";
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

  it("asks for the gpu win-back check of the wallet's owner from the moment the lease was created", async () => {
    const { handler, gpuWinBackService } = setup();

    await handler.handle(PAYLOAD);

    expect(gpuWinBackService.scheduleCheckAfterLease).toHaveBeenCalledWith({ walletId: 7, leaseCreatedAt: new Date("2026-09-21T10:00:00.000Z") });
  });

  it("swallows a failure to schedule the win-back check, because the deployment does not depend on it", async () => {
    const { handler, gpuWinBackService, logger } = setup();
    gpuWinBackService.scheduleCheckAfterLease.mockRejectedValue(new Error("queue down"));

    await expect(handler.handle(PAYLOAD)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_WIN_BACK_CHECK_SCHEDULE_FAILED", walletId: 7, dseq: "12345" }));
  });

  it("still schedules the win-back check when the gpus could not be scheduled for reading", async () => {
    const { handler, gpuDetectionJobService, gpuOfferJobService, gpuWinBackService } = setup();
    gpuOfferJobService.schedule.mockRejectedValue(new Error("queue down"));
    gpuDetectionJobService.scheduleInitial.mockRejectedValue(new Error("queue down"));

    await handler.handle(PAYLOAD);

    expect(gpuWinBackService.scheduleCheckAfterLease).toHaveBeenCalled();
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(setup().handler.requiresPermission()).toEqual([]);
  });

  it("declares the exclusive policy, so a lease followed up twice schedules its gpu reads once", () => {
    expect(setup().handler.policy).toBe("exclusive");
  });

  function setup() {
    const gpuDetectionJobService = mock<LeaseGpuDetectionJobService>();
    const gpuOfferJobService = mock<LeaseGpuOfferJobService>();
    const gpuWinBackService = mock<GpuWinBackService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const handler = new ManagedDeploymentLeaseCreatedHandler(
      gpuDetectionJobService,
      gpuOfferJobService,
      gpuWinBackService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { handler, gpuDetectionJobService, gpuOfferJobService, gpuWinBackService, logger };
  }
});
