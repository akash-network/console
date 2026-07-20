import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import { X402ReconcileJobService } from "@src/billing/services/x402-reconcile-job/x402-reconcile-job.service";
import type { JobQueueService } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";

describe(X402ReconcileJobService.name, () => {
  describe("scheduleInitial", () => {
    it("seeds the recurring job when x402 is enabled", async () => {
      const { service, jobQueueService } = setup();

      await service.scheduleInitial();

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: "x402-reconcile-settled", singletonKey: "x402-reconcile-settled" });
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      const [, options] = jobQueueService.enqueue.mock.calls[0];
      expect(options).toMatchObject({ singletonKey: "x402-reconcile-settled", startAfter: expect.any(String) });
    });

    it("does not seed the job when x402 is disabled", async () => {
      const { service, jobQueueService } = setup({ X402_ENABLED: "false" });

      await service.scheduleInitial();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("does not seed the job when the pay-to address is missing", async () => {
      const { service, jobQueueService } = setup({ X402_PAY_TO_ADDRESS: undefined });

      await service.scheduleInitial();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("schedule", () => {
    it("cancels any pending duplicate before enqueuing the next run", async () => {
      const { service, jobQueueService } = setup();

      await service.schedule({ startAfterSeconds: 60 });

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: "x402-reconcile-settled", singletonKey: "x402-reconcile-settled" });
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  function setup(configOverrides: Partial<BillingConfig> = {}) {
    const config = mock<BillingConfig>();
    Object.assign(config, {
      X402_ENABLED: "true",
      X402_PAY_TO_ADDRESS: "0x1111111111111111111111111111111111111111",
      X402_RECONCILE_INTERVAL_SECONDS: 300,
      ...configOverrides
    });

    const jobQueueService = mock<JobQueueService>();
    const logger = mock<LoggerService>();

    const service = new X402ReconcileJobService(config, jobQueueService, logger);

    return { service, config, jobQueueService, logger };
  }
});
