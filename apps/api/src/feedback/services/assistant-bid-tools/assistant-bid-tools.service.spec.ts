import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidController } from "@src/bid/controllers/bid/bid.controller";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import type { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import type { PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { AssistantAddressNamesService } from "@src/feedback/services/assistant-address-names/assistant-address-names.service";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";
import { AssistantBidToolsService } from "./assistant-bid-tools.service";

import { createBid } from "@test/seeders/bid.seeder";
import { createDeploymentLease, createGetDeploymentResponseData } from "@test/seeders/get-deployment-response.seeder";

function groupSpec(name: string, gpuModel?: string): GroupSpec {
  const attributes = gpuModel ? [{ key: `vendor/nvidia/model/${gpuModel}`, value: "true" }] : [];
  return GroupSpec.fromPartial({ name, resources: [{ resource: { gpu: { attributes } } }] });
}

function placedGroupSpec(name: string, attributes: { key: string; value: string }[]): GroupSpec {
  return GroupSpec.fromPartial({ name, requirements: { signedBy: { anyOf: ["akash1auditor"] }, attributes }, resources: [{ resource: {} }] });
}

describe(AssistantBidToolsService.name, () => {
  it("lists the bids with their provider names and skips screening when an open bid exists", async () => {
    const bid = createBid({ dseq: "42", gseq: 1, oseq: 1 });
    const unnamedBid = createBid({ dseq: "42", gseq: 1, oseq: 1 });
    unnamedBid.bid.price = { denom: "uact", amount: "2.93" };
    const { service, bidController, deploymentController, sdlService, addressNamesService } = setup({
      providerNames: { [bid.bid.id.provider]: "provider.europlots.com" }
    });
    bid.bid.price = { denom: "uact", amount: "2.93" };
    bidController.list.mockResolvedValue({ data: [bid, unnamedBid] });
    deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", name: "llama-chat" }) });

    const result = await service.getBids({ dseq: "42" });

    expect(bidController.list).toHaveBeenCalledWith("42");
    expect(addressNamesService.providerNamesOf).toHaveBeenCalledWith([bid.bid.id.provider, unnamedBid.bid.id.provider]);
    expect(result).toEqual({
      dseq: "42",
      name: "llama-chat",
      deploymentState: "active",
      leaseCount: 0,
      bids: [
        {
          gseq: 1,
          oseq: 1,
          providerName: "provider.europlots.com",
          providerAddress: bid.bid.id.provider,
          state: "open",
          usdPerMonth: 1.28,
          reclamationWindow: null
        },
        { gseq: 1, oseq: 1, providerName: null, providerAddress: unnamedBid.bid.id.provider, state: "open", usdPerMonth: 1.28, reclamationWindow: null }
      ],
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
      providersAbleToBid: 0,
      groups: [
        { group: "gpu", requestedGpus: ["nvidia/h100"], providersAbleToBid: 0, reason: "No provider has nvidia/h100 free right now." },
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

    expect(result.availability).toEqual({
      providersAbleToBid: null,
      groups: [{ group: "web", requestedGpus: [], providersAbleToBid: null }],
      gpuModelsWithFreeCapacity: null
    });
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

  describe("checkAvailability", () => {
    it("screens the SDL as a create would and counts the providers able to bid on every group", async () => {
      const { service, sdlService, bidScreeningHttpService } = setup();
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [groupSpec("web"), groupSpec("db")] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce(["p1", "p2", "p3"]).mockResolvedValueOnce(["p1"]);

      const availability = await service.checkAvailability("sdl", { isTrialing: true });

      expect(sdlService.generateManifest).toHaveBeenCalledWith("sdl", { isTrialing: true });
      expect(availability).toEqual({
        providersAbleToBid: 1,
        groups: [
          { group: "web", requestedGpus: [], providersAbleToBid: 3 },
          { group: "db", requestedGpus: [], providersAbleToBid: 1 }
        ],
        gpuModelsWithFreeCapacity: null
      });
    });

    it("refuses an SDL a create would refuse, with every reason", async () => {
      const { service, sdlService } = setup();
      sdlService.generateManifest.mockResolvedValue({
        ok: false,
        value: [
          { schemaPath: "", instancePath: "", keyword: "gpu", params: {}, message: "H100 not available on free trial" },
          { schemaPath: "", instancePath: "", keyword: "yaml", params: {}, message: "bad indent" }
        ]
      });

      const error = await service.checkAvailability("bad", { isTrialing: true }).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(AssistantToolError);
      expect(error).toMatchObject({ message: "The SDL is not valid.", untrustedDetail: "H100 not available on free trial; bad indent" });
    });

    it("reports the count as unknown when any group's screening did not answer", async () => {
      const { service, sdlService, bidScreeningHttpService } = setup();
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [groupSpec("web"), groupSpec("db")] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce(["p1"]).mockRejectedValueOnce(new Error("down"));

      expect((await service.checkAvailability("sdl", { isTrialing: false })).providersAbleToBid).toBeNull();
    });

    it("lists every unsigned placement attribute", async () => {
      const { service, sdlService, bidScreeningHttpService } = setup();
      const attributes = [
        { key: "host", value: "akash" },
        { key: "tier", value: "community" }
      ];
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [placedGroupSpec("dcloud", attributes)] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce([]).mockResolvedValueOnce(["p1"]);

      const availability = await service.checkAvailability("sdl", { isTrialing: false });

      expect(availability.groups[0].reason).toBe(
        "No audited provider has signed the placement attributes host=akash, tier=community. Without them, 1 providers could bid."
      );
    });

    it("names every requested gpu model when none of them has free capacity", async () => {
      const { service, sdlService, bidScreeningHttpService, placementOptionsHttpService } = setup();
      const twoModels = GroupSpec.fromPartial({
        name: "gpu",
        resources: [
          { resource: { gpu: { attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] } } },
          { resource: { gpu: { attributes: [{ key: "vendor/nvidia/model/h200", value: "true" }] } } }
        ]
      });
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [twoModels] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValue([]);
      placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([{ vendor: "nvidia", model: "a100" }]);

      const availability = await service.checkAvailability("sdl", { isTrialing: false });

      expect(availability.groups[0].reason).toBe("No provider has nvidia/h100, nvidia/h200 free right now.");
    });

    it("blames missing capacity when one of the requested gpu models is free", async () => {
      const { service, sdlService, bidScreeningHttpService, placementOptionsHttpService } = setup();
      const twoModels = GroupSpec.fromPartial({
        name: "gpu",
        resources: [
          { resource: { gpu: { attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] } } },
          { resource: { gpu: { attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] } } }
        ]
      });
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [twoModels] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValue([]);
      placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([{ vendor: "nvidia", model: "a100" }]);

      const availability = await service.checkAvailability("sdl", { isTrialing: false });

      expect(availability.groups[0].reason).toBe("No provider has these resources free right now.");
    });

    it("names placement attributes no audited provider signed when the group has bidders without them", async () => {
      const { service, sdlService, bidScreeningHttpService } = setup();
      const placed = placedGroupSpec("dcloud", [{ key: "host", value: "akash" }]);
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [placed] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce([]).mockResolvedValueOnce(["p1", "p2", "p3", "p4"]);

      const availability = await service.checkAvailability("sdl", { isTrialing: false });

      expect(bidScreeningHttpService.findScreenedProviders).toHaveBeenLastCalledWith({ ...placed, requirements: { ...placed.requirements, attributes: [] } });
      expect(availability.groups[0].reason).toBe("No audited provider has signed the placement attributes host=akash. Without them, 4 providers could bid.");
    });

    it.each([
      ["no bidders", async () => []],
      [
        "a failed screening",
        async () => {
          throw new Error("down");
        }
      ]
    ])("blames missing capacity when dropping the placement attributes leaves %s", async (_, screenWithoutAttributes) => {
      const { service, sdlService, bidScreeningHttpService } = setup();
      sdlService.generateManifest.mockResolvedValue({
        ok: true,
        value: { groups: [], groupSpecs: [placedGroupSpec("dcloud", [{ key: "region", value: "us-west" }])] }
      });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce([]).mockImplementationOnce(screenWithoutAttributes);

      const availability = await service.checkAvailability("sdl", { isTrialing: false });

      expect(availability.groups[0].reason).toBe("No provider has these resources free right now.");
    });

    it.each([
      ["has free capacity", async () => [{ vendor: "nvidia", model: "h100" }]],
      [
        "is unknown",
        async () => {
          throw new Error("down");
        }
      ]
    ])("blames missing capacity rather than the gpu model when the model %s", async (_, findAvailableGpuModels) => {
      const { service, sdlService, bidScreeningHttpService, placementOptionsHttpService } = setup();
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [groupSpec("gpu", "h100")] } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValue([]);
      placementOptionsHttpService.findAvailableGpuModels.mockImplementation(findAvailableGpuModels);

      const availability = await service.checkAvailability("sdl", { isTrialing: false });

      expect(availability.groups[0].reason).toBe("No provider has these resources free right now.");
      expect(bidScreeningHttpService.findScreenedProviders).toHaveBeenCalledTimes(1);
    });
  });

  function setup(input: { providerNames?: Record<string, string> } = {}) {
    const bidController = mock<BidController>();
    bidController.list.mockResolvedValue({ data: [] });
    const deploymentController = mock<DeploymentController>();
    deploymentController.findByDseq.mockImplementation(async dseq => ({ data: createGetDeploymentResponseData({ dseq }) }));
    const sdlService = mock<SdlService>();
    const bidScreeningHttpService = mock<BidScreeningHttpService>();
    const placementOptionsHttpService = mock<PlacementOptionsHttpService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const denomExchangeService = mock<DenomExchangeService>();
    const addressNamesService = mock<AssistantAddressNamesService>();
    addressNamesService.providerNamesOf.mockResolvedValue(new Map(Object.entries(input.providerNames ?? {})));
    denomExchangeService.getExchangeRateToUSD.mockResolvedValue(mock<Awaited<ReturnType<DenomExchangeService["getExchangeRateToUSD"]>>>({ price: 1 }));
    const service = new AssistantBidToolsService(
      bidController,
      deploymentController,
      sdlService,
      bidScreeningHttpService,
      placementOptionsHttpService,
      new AssistantUsdService(denomExchangeService),
      addressNamesService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, bidController, deploymentController, sdlService, bidScreeningHttpService, placementOptionsHttpService, logger, addressNamesService };
  }
});
