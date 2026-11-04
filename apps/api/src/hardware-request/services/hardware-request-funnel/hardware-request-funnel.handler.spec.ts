import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestFunnelHandler, HardwareRequestFunnelJob } from "./hardware-request-funnel.handler";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(HardwareRequestFunnelHandler.name, () => {
  it("reports the step for the requester with the request's lane, value, source and age", async () => {
    const { handler, analyticsService, hardwareRequest } = setup({});

    await handler.handle({
      hardwareRequestId: hardwareRequest.id,
      step: "gpu_request_offer_published",
      stepKey: "offer-1",
      occurredAt: "2026-11-04T13:30:00.000Z",
      properties: { offerId: "offer-1", usdPerGpuHour: 2.4 },
      version: 1
    });

    expect(analyticsService.track).toHaveBeenCalledWith(
      "user-1",
      "gpu_request_offer_published",
      {
        hardwareRequestId: hardwareRequest.id,
        lane: "sales",
        estimatedMonthlyUsd: 25000,
        source: "no_fit",
        hoursSinceRequest: 25.5,
        offerId: "offer-1",
        usdPerGpuHour: 2.4
      },
      { insertId: "gpu_request_offer_published:offer-1" }
    );
  });

  it("rounds the request's age to a tenth of an hour", async () => {
    const { handler, analyticsService, hardwareRequest } = setup({});

    await handler.handle({
      hardwareRequestId: hardwareRequest.id,
      step: "gpu_request_created",
      stepKey: hardwareRequest.id,
      occurredAt: "2026-11-03T12:04:00.000Z",
      version: 1
    });

    expect(analyticsService.track).toHaveBeenCalledWith("user-1", "gpu_request_created", expect.objectContaining({ hoursSinceRequest: 0.1 }), {
      insertId: `gpu_request_created:${hardwareRequest.id}`
    });
  });

  it("skips a request filed for someone with no account yet", async () => {
    const { handler, analyticsService, logger, hardwareRequest } = setup({ userId: null });

    await handler.handle({
      hardwareRequestId: hardwareRequest.id,
      step: "gpu_request_first_reply",
      stepKey: "key",
      occurredAt: "2026-11-04T00:00:00.000Z",
      version: 1
    });

    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_FUNNEL_STEP_SKIPPED",
      hardwareRequestId: hardwareRequest.id,
      step: "gpu_request_first_reply",
      reason: "Request has no account yet"
    });
  });

  it("skips a request that no longer exists", async () => {
    const { handler, analyticsService, logger, hardwareRequestRepository } = setup({});
    hardwareRequestRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ hardwareRequestId: "missing", step: "gpu_request_closed", stepKey: "key", occurredAt: "2026-11-04T00:00:00.000Z", version: 1 });

    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_FUNNEL_STEP_SKIPPED",
      hardwareRequestId: "missing",
      step: "gpu_request_closed",
      reason: "Hardware request not found"
    });
  });

  it("needs no permissions, handles its own job and logs under its own name", () => {
    const { handler, createLogger } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
    expect(handler.accepts).toBe(HardwareRequestFunnelJob);
    expect(new HardwareRequestFunnelJob({ hardwareRequestId: "id", step: "gpu_request_created", stepKey: "id", occurredAt: "now" }).name).toBe(
      "HardwareRequestFunnelJob"
    );
    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestFunnelHandler.name });
  });

  function setup(input: { userId?: string | null }) {
    const hardwareRequest = createHardwareRequest({
      userId: input.userId === undefined ? "user-1" : input.userId,
      lane: "sales",
      estimatedMonthlyUsd: 25000,
      source: "no_fit",
      createdAt: "2026-11-03T12:00:00.000Z"
    });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new HardwareRequestFunnelHandler(hardwareRequestRepository, analyticsService, createLogger);

    return { handler, hardwareRequestRepository, analyticsService, logger, createLogger, hardwareRequest };
  }
});
