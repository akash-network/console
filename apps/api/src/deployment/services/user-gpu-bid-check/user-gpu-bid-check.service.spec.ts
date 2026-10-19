import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { ScreenUserGpuDeployment } from "@src/deployment/services/screen-user-gpu-deployment/screen-user-gpu-deployment.handler";
import { encodeCreateDeploymentMessage } from "@src/deployment/utils/create-deployment-message/create-deployment-message";
import { UserGpuBidCheckService } from "./user-gpu-bid-check.service";

describe(UserGpuBidCheckService.name, () => {
  it("screens a deployment pinned to a gpu model once the configure page's wait for a first bid is over", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-19T12:00:00Z") });
    try {
      const { service, jobQueueService } = setup();

      await service.scheduleFor({ dseq: "123", message: aMessage(["vendor/nvidia/model/h100"]) });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ScreenUserGpuDeployment({ owner: "akash1owner", dseq: "123" }), {
        singletonKey: "screenUserGpuDeployment.akash1owner.123",
        startAfter: "2026-10-19T12:01:00.000Z"
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("screens a deployment whose gpu group sits next to groups without a gpu", async () => {
    const { service, jobQueueService } = setup();

    await service.scheduleFor({ dseq: "123", message: aMessage([], ["vendor/nvidia/model/h100"]) });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ScreenUserGpuDeployment({ owner: "akash1owner", dseq: "123" }), expect.anything());
  });

  it.each([[[]], [["vendor/nvidia/model/*"]]])("schedules nothing for a deployment pinned to no single gpu model: %j", async keys => {
    const { service, jobQueueService } = setup();

    await service.scheduleFor({ dseq: "123", message: aMessage(keys) });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("schedules nothing for a message without a deployment id", async () => {
    const { service, jobQueueService } = setup();

    await service.scheduleFor({ dseq: "123", message: encodeCreateDeploymentMessage(MsgCreateDeployment.fromPartial({ groups: [] })) });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("never fails the create it follows", async () => {
    const { service, jobQueueService, logger } = setup();
    jobQueueService.enqueue.mockRejectedValue(new Error("queue unavailable"));

    await expect(service.scheduleFor({ dseq: "123", message: aMessage(["vendor/nvidia/model/h100"]) })).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith({ event: "USER_GPU_BID_CHECK_NOT_SCHEDULED", dseq: "123", error: new Error("queue unavailable") });
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: UserGpuBidCheckService.name });
  });

  function aMessage(...gpuKeysPerGroup: string[][]): string {
    return encodeCreateDeploymentMessage(
      MsgCreateDeployment.fromPartial({
        id: { owner: "akash1owner", dseq: 123n },
        groups: gpuKeysPerGroup.map((gpuKeys, index) => ({
          name: `group-${index}`,
          resources: [{ resource: { gpu: { attributes: gpuKeys.map(key => ({ key, value: "true" })) } } }]
        }))
      })
    );
  }

  function setup() {
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    return { service: new UserGpuBidCheckService(jobQueueService, createLogger), jobQueueService, logger, createLogger };
  }
});
