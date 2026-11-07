import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { type GpuAsk, toAskToken, toDedupeKey } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import type { UnmetDemandEventRepository } from "@src/deployment/repositories/unmet-demand-event/unmet-demand-event.repository";
import { RecordUnmetGpuScreening } from "@src/deployment/services/record-unmet-gpu-screening/record-unmet-gpu-screening.handler";
import { UnmetGpuDemandService } from "./unmet-gpu-demand.service";

const OCCURRED_AT = new Date("2026-11-06T10:00:00Z");

const ASK: GpuAsk = { vendor: "nvidia", model: "h100", gpuCount: 8, regionArea: "eu" };

describe(UnmetGpuDemandService.name, () => {
  describe("recordEmptyScreening", () => {
    it("queues each ask of a screening that listed no provider with its token in place of the asker", async () => {
      const { service, jobQueueService } = setup();
      const otherAsk: GpuAsk = { vendor: null, model: null, gpuCount: 1, regionArea: null };

      await service.recordEmptyScreening({ providers: [] }, { asks: [ASK, otherAsk], actorId: "user-1", occurredAt: OCCURRED_AT });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new RecordUnmetGpuScreening({
          occurredAt: "2026-11-06T10:00:00.000Z",
          asks: [
            { ...ASK, askToken: toAskToken(ASK, OCCURRED_AT, "user-1") },
            { ...otherAsk, askToken: toAskToken(otherAsk, OCCURRED_AT, "user-1") }
          ]
        })
      );
      expect(JSON.stringify(jobQueueService.enqueue.mock.calls)).not.toContain("user-1");
    });

    it("queues nothing for a screening that listed a provider", async () => {
      const { service, jobQueueService } = setup();

      await service.recordEmptyScreening({ providers: [{ owner: "akash1provider" }] }, { asks: [ASK], actorId: "user-1", occurredAt: OCCURRED_AT });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("queues nothing for a screening it cannot read", async () => {
      const { service, jobQueueService } = setup();

      await service.recordEmptyScreening({ error: "unexpected" }, { asks: [ASK], actorId: "user-1", occurredAt: OCCURRED_AT });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("queues nothing for a request that asks for no gpu", async () => {
      const { service, jobQueueService } = setup();

      await service.recordEmptyScreening({ providers: [] }, { asks: [], actorId: "user-1", occurredAt: OCCURRED_AT });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("logs and swallows a failure to queue, so the screening still answers", async () => {
      const { service, jobQueueService, logger } = setup();
      const error = new Error("queue down");
      jobQueueService.enqueue.mockRejectedValue(error);

      await expect(service.recordEmptyScreening({ providers: [] }, { asks: [ASK], actorId: "user-1", occurredAt: OCCURRED_AT })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "UNMET_DEMAND_RECORD_FAILED", kind: "screening", error });
    });
  });

  describe("recordZeroBids", () => {
    it("stores each ask as a zero bid deduplicated on the asker and day, without the asker", async () => {
      const { service, unmetDemandEventRepository } = setup();

      await service.recordZeroBids({ asks: [ASK], actorId: "akash1owner", occurredAt: OCCURRED_AT });

      expect(unmetDemandEventRepository.insertMany).toHaveBeenCalledWith([
        { ...ASK, kind: "zero_bid", dedupeKey: toDedupeKey("zero_bid", toAskToken(ASK, OCCURRED_AT, "akash1owner")), occurredAt: OCCURRED_AT }
      ]);
    });

    it("logs and swallows a failure to store, so the bid read still completes", async () => {
      const { service, unmetDemandEventRepository, logger } = setup();
      const error = new Error("db down");
      unmetDemandEventRepository.insertMany.mockRejectedValue(error);

      await expect(service.recordZeroBids({ asks: [ASK], actorId: "akash1owner", occurredAt: OCCURRED_AT })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "UNMET_DEMAND_RECORD_FAILED", kind: "zero_bid", error });
    });
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: UnmetGpuDemandService.name });
  });

  function setup() {
    const jobQueueService = mock<JobQueueService>();
    const unmetDemandEventRepository = mock<UnmetDemandEventRepository>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new UnmetGpuDemandService(jobQueueService, unmetDemandEventRepository, createLogger);

    return { service, jobQueueService, unmetDemandEventRepository, logger, createLogger };
  }
});
