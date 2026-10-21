import { Deployment_State } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { GroupSpec, type QueryDeploymentResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { QueryOrdersResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import { RecordUserGpuBids } from "@src/deployment/services/record-user-gpu-bids/record-user-gpu-bids.handler";
import { ScreenUserGpuDeploymentHandler } from "./screen-user-gpu-deployment.handler";

const PAYLOAD = { owner: "akash1owner", dseq: "123", version: 1 as const };

describe(ScreenUserGpuDeploymentHandler.name, () => {
  it("records, a few minutes later, which providers screening lists for each group pinned to a gpu model and whether its order is still open", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-19T12:01:00Z") });
    try {
      const { handler, jobQueueService } = setup({
        groups: [aGroup(1, ["vendor/nvidia/model/h100"]), aGroup(2, ["vendor/nvidia/model/a100"]), aGroup(3, [])],
        screened: { "group-1": ["akash1first", "akash1second"], "group-2": ["akash1third"] },
        openGseqs: [1]
      });

      await handler.handle(PAYLOAD);

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new RecordUserGpuBids({
          owner: "akash1owner",
          dseq: "123",
          groups: [
            { gseq: 1, vendor: "nvidia", model: "h100", screened: ["akash1first", "akash1second"], wasOpenThroughWait: true },
            { gseq: 2, vendor: "nvidia", model: "a100", screened: ["akash1third"], wasOpenThroughWait: false }
          ]
        }),
        { singletonKey: "recordUserGpuBids.akash1owner.123", startAfter: "2026-10-19T12:05:00.000Z" }
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads the deployment and its open orders by owner and dseq", async () => {
    const { handler, chainSdk } = setup({ groups: [aGroup(1, ["vendor/nvidia/model/h100"])] });

    await handler.handle(PAYLOAD);

    expect(chainSdk.akash.deployment.v1beta4.getDeployment).toHaveBeenCalledWith({ id: { owner: "akash1owner", dseq: 123n } });
    expect(chainSdk.akash.market.v1beta5.getOrders).toHaveBeenCalledWith({ filters: { owner: "akash1owner", dseq: 123n, state: "open" } });
  });

  it.each([Deployment_State.closed, Deployment_State.invalid])("records nothing for a deployment that is no longer active: %s", async state => {
    const { handler, jobQueueService, bidScreeningHttpService, logger } = setup({ groups: [aGroup(1, ["vendor/nvidia/model/h100"])], state });

    await handler.handle(PAYLOAD);

    expect(bidScreeningHttpService.findScreenedProviders).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "USER_GPU_DEPLOYMENT_NOT_ACTIVE", owner: "akash1owner", dseq: "123" });
  });

  it("records nothing when the chain answers without a deployment", async () => {
    const { handler, chainSdk, jobQueueService } = setup({ groups: [aGroup(1, ["vendor/nvidia/model/h100"])] });
    chainSdk.akash.deployment.v1beta4.getDeployment.mockResolvedValue({
      deployment: undefined,
      groups: [aGroup(1, ["vendor/nvidia/model/h100"])],
      escrowAccount: undefined
    });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("records nothing for a deployment the chain does not have", async () => {
    const { handler, chainSdk, jobQueueService } = setup({ groups: [] });
    chainSdk.akash.deployment.v1beta4.getDeployment.mockRejectedValue(new SDKError("Deployment not found", SDKErrorCode.NotFound));

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("fails so the job retries when the chain cannot be read", async () => {
    const { handler, chainSdk } = setup({ groups: [] });
    chainSdk.akash.deployment.v1beta4.getDeployment.mockRejectedValue(new SDKError("unavailable", SDKErrorCode.Unavailable));

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("unavailable");
  });

  it("records nothing for a deployment none of whose groups is pinned to one gpu model", async () => {
    const { handler, jobQueueService, bidScreeningHttpService } = setup({
      groups: [aGroup(1, []), aGroup(2, ["vendor/nvidia/model/h100", "vendor/nvidia/model/a100"])]
    });

    await handler.handle(PAYLOAD);

    expect(bidScreeningHttpService.findScreenedProviders).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("skips a group the chain returns without an id or a spec", async () => {
    const { handler, jobQueueService } = setup({
      groups: [
        { ...aGroup(1, ["vendor/nvidia/model/h100"]), id: undefined },
        { ...aGroup(2, ["vendor/nvidia/model/h100"]), groupSpec: undefined }
      ]
    });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("declares no permissions, because a worker carries no user", () => {
    const { handler } = setup({ groups: [] });

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("logs under its own name", () => {
    const { createLogger } = setup({ groups: [] });

    expect(createLogger).toHaveBeenCalledWith({ context: ScreenUserGpuDeploymentHandler.name });
  });

  function aGroup(gseq: number, gpuKeys: string[]): QueryDeploymentResponse["groups"][number] {
    return {
      id: { owner: "akash1owner", dseq: 123n, gseq },
      state: 1,
      groupSpec: GroupSpec.fromPartial({
        name: `group-${gseq}`,
        resources: [{ resource: { gpu: { attributes: gpuKeys.map(key => ({ key, value: "true" })) } } }]
      }),
      createdAt: 1n
    };
  }

  function setup(input: { groups: QueryDeploymentResponse["groups"]; state?: Deployment_State; screened?: Record<string, string[]>; openGseqs?: number[] }) {
    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.akash.deployment.v1beta4.getDeployment.mockResolvedValue(
      mock<QueryDeploymentResponse>({ deployment: mock({ state: input.state ?? Deployment_State.active }), groups: input.groups })
    );
    const orders: QueryOrdersResponse = {
      orders: (input.openGseqs ?? []).map(gseq => mock<QueryOrdersResponse["orders"][number]>({ id: { owner: "akash1owner", dseq: 123n, gseq, oseq: 1 } })),
      pagination: undefined
    };
    chainSdk.akash.market.v1beta5.getOrders.mockResolvedValue(orders);

    const bidScreeningHttpService = mock<BidScreeningHttpService>();
    bidScreeningHttpService.findScreenedProviders.mockImplementation(async groupSpec => input.screened?.[groupSpec.name] ?? []);

    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new ScreenUserGpuDeploymentHandler(chainSdk, bidScreeningHttpService, jobQueueService, createLogger);

    return { handler, chainSdk, bidScreeningHttpService, jobQueueService, logger, createLogger };
  }
});
