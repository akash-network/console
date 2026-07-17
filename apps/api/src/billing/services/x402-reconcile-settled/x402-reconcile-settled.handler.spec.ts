import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { X402ReconcileSettled } from "@src/billing/events/x402-reconcile-settled";
import type { X402Service } from "@src/billing/services/x402/x402.service";
import type { X402ReconcileJobService } from "@src/billing/services/x402-reconcile-job/x402-reconcile-job.service";
import { X402ReconcileSettledHandler } from "@src/billing/services/x402-reconcile-settled/x402-reconcile-settled.handler";
import { JOB_NAME } from "@src/core";

describe(X402ReconcileSettledHandler.name, () => {
  it("accepts the x402-reconcile-settled queue as a singleton", () => {
    const { handler } = setup();

    expect(handler.accepts[JOB_NAME]).toBe("x402-reconcile-settled");
    expect(handler.policy).toBe("singleton");
    expect(handler.concurrency).toBe(1);
  });

  it("drives the reconcile pass and reschedules the next run", async () => {
    const { handler, x402Service, x402ReconcileJobService } = setup();
    x402Service.reconcileStaleSettled.mockResolvedValue({ backlog: 3, credited: 2, failed: 0 });

    await handler.handle(new X402ReconcileSettled().data);

    expect(x402Service.reconcileStaleSettled).toHaveBeenCalledTimes(1);
    expect(x402ReconcileJobService.schedule).toHaveBeenCalledTimes(1);
  });

  it("still reschedules the next run when a pass throws", async () => {
    const { handler, x402Service, x402ReconcileJobService } = setup();
    x402Service.reconcileStaleSettled.mockRejectedValue(new Error("scan failed"));

    await expect(handler.handle(new X402ReconcileSettled().data)).rejects.toThrow("scan failed");

    expect(x402ReconcileJobService.schedule).toHaveBeenCalledTimes(1);
  });

  function setup() {
    const x402Service = mock<X402Service>();
    const x402ReconcileJobService = mock<X402ReconcileJobService>();
    const handler = new X402ReconcileSettledHandler(x402Service, x402ReconcileJobService);

    return { handler, x402Service, x402ReconcileJobService };
  }
});
