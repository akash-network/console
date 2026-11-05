import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidController } from "@src/bid/controllers/bid/bid.controller";
import type { CreateLogger } from "@src/core";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import type { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import type { PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { AssistantBidToolsService } from "./assistant-bid-tools.service";

import { createBid } from "@test/seeders/bid.seeder";
import { createDeploymentLease, createGetDeploymentResponseData } from "@test/seeders/get-deployment-response.seeder";

function groupSpec(name: string, gpuModel?: string): GroupSpec {
  const attributes = gpuModel ? [{ key: `vendor/nvidia/model/${gpuModel}`, value: "true" }] : [];
  return GroupSpec.fromPartial({ name, resources: [{ resource: { gpu: { attributes } } }] });
}

describe(AssistantBidToolsService.name, () => {
  it("lists the bids and skips screening when an open bid exists", async () => {
    const { service, bidController, sdlService } = setup();
    const bid = createBid({ dseq: "42", gseq: 1, oseq: 1 });
    bidController.list.mockResolvedValue({ data: [bid] });

    const result = await service.getBids({ dseq: "42" });

    expect(bidController.list).toHaveBeenCalledWith("42");
    expect(result).toEqual({
      dseq: "42",
      deploymentState: "active",
      leaseCount: 0,
      bids: [{ gseq: 1, oseq: 1, provider: bid.bid.id.provider, state: "open", price: bid.bid.price, reclamationWindow: null }],
      availability: null
    });
    expect(sdlService.generateManifest).not.toHaveBeenCalled();
  });

  it("skips screening for a leased or closed deployment", async () => {
    const { service, deploymentController, sdlService } = setup();
    deploymentController.findByDseq.mockResolvedValueOnce({ data: createGetDeploymentResponseData({ leases: [createDeploymentLease()] }) });
    deploymentController.findByDseq.mockResolvedValueOnce({ data: createGetDeploymentResponseData({ state: "closed" }) });

    expect(await service.getBids({ dseq: "42" })).toMatchObject({ leaseCount: 1, availability: null });
    expect(await service.getBids({ dseq: "42" })).toMatchObject({ deploymentState: "closed", availability: null });
    expect(sdlService.generateManifest).not.toHaveBeenCalled();
  });

  it("explains missing bids with screening per group and the gpu models that have free capacity", async () => {
    const { service, bidController, sdlService, bidScreeningHttpService, placementOptionsHttpService } = setup();
    const closedBid = createBid({ dseq: "42" });
    closedBid.bid.state = "closed";
    closedBid.bid.reclamation_window = "3600s";
    bidController.list.mockResolvedValue({ data: [closedBid] });
    const gpuGroup = groupSpec("gpu", "h100");
    sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [gpuGroup, groupSpec("web")] } });
    bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce([]).mockResolvedValueOnce(["p1", "p2"]);
    placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([{ vendor: "nvidia", model: "a100" }]);

    const result = await service.getBids({ dseq: "42" });

    expect(sdlService.generateManifest).toHaveBeenCalledWith(expect.stringContaining("nginx:1.25.3"));
    expect(bidScreeningHttpService.findScreenedProviders).toHaveBeenCalledWith(gpuGroup);
    expect(result.bids[0]).toMatchObject({ state: "closed", reclamationWindow: "3600s" });
    expect(result.availability).toEqual({
      groups: [
        { group: "gpu", requestedGpus: ["nvidia/h100"], providersAbleToBid: 0 },
        { group: "web", requestedGpus: [], providersAbleToBid: 2 }
      ],
      gpuModelsWithFreeCapacity: ["nvidia/a100"]
    });
  });

  it("asks for no gpu models when no group requests one, and reports a failed screening as unknown", async () => {
    const { service, sdlService, bidScreeningHttpService, placementOptionsHttpService, logger } = setup();
    sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [groupSpec("web")] } });
    const error = new Error("inventory down");
    bidScreeningHttpService.findScreenedProviders.mockRejectedValue(error);

    const result = await service.getBids({ dseq: "42" });

    expect(result.availability).toEqual({ groups: [{ group: "web", requestedGpus: [], providersAbleToBid: null }], gpuModelsWithFreeCapacity: null });
    expect(placementOptionsHttpService.findAvailableGpuModels).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_BID_SCREENING_FAILED", error });
  });

  it("reports unknown gpu availability when placement options fail", async () => {
    const { service, sdlService, bidScreeningHttpService, placementOptionsHttpService, logger } = setup();
    sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [groupSpec("gpu", "a100")] } });
    bidScreeningHttpService.findScreenedProviders.mockResolvedValue(["p1"]);
    const error = new Error("down");
    placementOptionsHttpService.findAvailableGpuModels.mockRejectedValue(error);

    expect((await service.getBids({ dseq: "42" })).availability).toMatchObject({ gpuModelsWithFreeCapacity: null });
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_PLACEMENT_OPTIONS_FAILED", error });
  });

  it("reports no availability without a readable SDL", async () => {
    const { service, deploymentController, sdlService } = setup();
    deploymentController.findByDseq.mockResolvedValueOnce({ data: createGetDeploymentResponseData({ sdl: null }) });

    expect((await service.getBids({ dseq: "42" })).availability).toBeNull();

    sdlService.generateManifest.mockResolvedValue({ ok: false, value: [] });
    expect((await service.getBids({ dseq: "42" })).availability).toBeNull();
  });

  function setup() {
    const bidController = mock<BidController>();
    bidController.list.mockResolvedValue({ data: [] });
    const deploymentController = mock<DeploymentController>();
    deploymentController.findByDseq.mockImplementation(async dseq => ({ data: createGetDeploymentResponseData({ dseq }) }));
    const sdlService = mock<SdlService>();
    const bidScreeningHttpService = mock<BidScreeningHttpService>();
    const placementOptionsHttpService = mock<PlacementOptionsHttpService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new AssistantBidToolsService(
      bidController,
      deploymentController,
      sdlService,
      bidScreeningHttpService,
      placementOptionsHttpService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, bidController, deploymentController, sdlService, bidScreeningHttpService, placementOptionsHttpService, logger };
  }
});
