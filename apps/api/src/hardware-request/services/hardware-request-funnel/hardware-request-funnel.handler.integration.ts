import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { HardwareRequestFunnelHandler, HardwareRequestFunnelJob } from "./hardware-request-funnel.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestFunnelHandler)]);

describe(HardwareRequestFunnelHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports a stored request's step to analytics, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const track = vi.spyOn(container.resolve(AnalyticsService), "track");
    const user = await seedUser();
    const hardwareRequest = await seedHardwareRequest({ userId: user.id, gpuModel: "H100", quantity: 8 });

    await enqueue(
      new HardwareRequestFunnelJob({
        hardwareRequestId: hardwareRequest.id,
        step: "gpu_request_first_reply",
        stepKey: hardwareRequest.id,
        occurredAt: new Date().toISOString()
      }),
      { singletonKey: hardwareRequest.id }
    );
    await startWorkers();
    await expectJobCompleted(HardwareRequestFunnelJob[JOB_NAME], { singletonKey: hardwareRequest.id });

    expect(track).toHaveBeenCalledWith(user.id, "gpu_request_first_reply", expect.objectContaining({ hardwareRequestId: hardwareRequest.id }), {
      insertId: `gpu_request_first_reply:${hardwareRequest.id}`
    });
  });
});
