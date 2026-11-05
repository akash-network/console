import { yaml } from "@akashnetwork/chain-sdk";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidController } from "@src/bid/controllers/bid/bid.controller";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import type { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import type { DeploymentSetting } from "@src/deployment/http-schemas/deployment-setting.schema";
import type { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { ProposalActionType, ProposalArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import type { TemplateController } from "@src/template/controllers/template/template.controller";
import type { Template } from "@src/template/types/template";
import { AssistantProposalService } from "./assistant-proposal.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { ASSISTANT_TEST_SDL, createGetDeploymentResponseData } from "@test/seeders/get-deployment-response.seeder";

const GPU_SDL = ASSISTANT_TEST_SDL.replace(
  "        storage:\n          size: 2Gi",
  "        storage:\n          size: 2Gi\n        gpu:\n          units: 2\n          attributes:\n            vendor:\n              nvidia:\n                - model: a100"
);

describe(AssistantProposalService.name, () => {
  describe("create_deployment", () => {
    it("validates a template's SDL as a trial would and reports how many providers could bid on every group", async () => {
      const { service, templateController, sdlService, bidScreeningHttpService } = setup();
      templateController.getTemplateById.mockResolvedValue({ data: mock<Template>({ deploy: ASSISTANT_TEST_SDL }) });
      const groupSpecs = [mock<GroupSpec>(), mock<GroupSpec>()];
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs } });
      bidScreeningHttpService.findScreenedProviders.mockResolvedValueOnce(["a", "b", "c"]).mockResolvedValueOnce(["a"]);

      const action = await propose(service, "create_deployment", { templateId: "akash-network-awesome-akash-nginx" }, { isTrialing: true });

      expect(sdlService.generateManifest).toHaveBeenCalledWith(ASSISTANT_TEST_SDL, { isTrialing: true });
      expect(bidScreeningHttpService.findScreenedProviders.mock.calls).toEqual([[groupSpecs[0]], [groupSpecs[1]]]);
      expect(action).toEqual({
        type: "create_deployment",
        tier: "confirm",
        templateId: "akash-network-awesome-akash-nginx",
        sdl: ASSISTANT_TEST_SDL,
        name: null,
        runtimeLimitHours: null,
        services: [{ service: "web", image: "nginx:1.25.3", resources: { cpu: 1, memory: "1Gi", storage: ["2Gi"], gpu: null, count: 1 } }],
        providersAbleToBid: 1
      });
    });

    it("takes a generated SDL with a name and runtime limit, and reports no count when screening fails", async () => {
      const { service, sdlService, bidScreeningHttpService } = setup();
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [mock<GroupSpec>()] } });
      bidScreeningHttpService.findScreenedProviders.mockRejectedValue(new Error("inventory down"));

      const action = await propose(service, "create_deployment", { sdl: ASSISTANT_TEST_SDL, name: "web", runtimeLimitHours: 12 }, { isTrialing: null });

      expect(sdlService.generateManifest).toHaveBeenCalledWith(ASSISTANT_TEST_SDL, { isTrialing: false });
      expect(action).toMatchObject({ templateId: null, name: "web", runtimeLimitHours: 12, providersAbleToBid: null });
    });

    it("lists no services for an SDL the summary cannot read", async () => {
      const { service, sdlService } = setup();
      sdlService.generateManifest.mockResolvedValue({ ok: true, value: { groups: [], groupSpecs: [] } });
      sdlService.parse.mockReturnValue({ ok: false, value: [] });

      expect(await propose(service, "create_deployment", { sdl: "x" })).toMatchObject({ services: [] });
    });

    it("refuses an SDL the create would refuse, with every reason", async () => {
      const { service, sdlService } = setup();
      sdlService.generateManifest.mockResolvedValue({
        ok: false,
        value: [
          { schemaPath: "", instancePath: "", keyword: "gpu", params: {}, message: "H100 not available on free trial" },
          { schemaPath: "", instancePath: "", keyword: "yaml", params: {}, message: "bad indent" }
        ]
      });

      await expect(propose(service, "create_deployment", { sdl: "bad" })).rejects.toThrow(
        new AssistantToolError("The SDL is not valid: H100 not available on free trial; bad indent")
      );
    });
  });

  describe("choose_bid", () => {
    it("attaches the price of each chosen open bid", async () => {
      const { service, bidController } = setup();
      const provider = createAkashAddress();
      const bid = createBid({ dseq: "42", provider, gseq: 1, oseq: 1 });
      bidController.list.mockResolvedValue({ data: [createBid({ dseq: "42", gseq: 1, oseq: 1 }), bid] });

      const action = await propose(service, "choose_bid", { dseq: "42", choices: [{ gseq: 1, oseq: 1, provider }] });

      expect(bidController.list).toHaveBeenCalledWith("42");
      expect(action).toEqual({ type: "choose_bid", tier: "confirm", dseq: "42", choices: [{ gseq: 1, oseq: 1, provider, price: bid.bid.price }] });
    });

    it.each([
      { state: "closed" as const, gseq: 1, oseq: 1 },
      { state: "open" as const, gseq: 2, oseq: 1 },
      { state: "open" as const, gseq: 1, oseq: 2 }
    ])("refuses a choice without a matching open bid (%o)", async ({ state, gseq, oseq }) => {
      const { service, bidController } = setup();
      const provider = createAkashAddress();
      const bid = createBid({ dseq: "42", provider, gseq, oseq });
      bid.bid.state = state;
      bidController.list.mockResolvedValue({ data: [bid] });

      await expect(propose(service, "choose_bid", { dseq: "42", choices: [{ gseq: 1, oseq: 1, provider }] })).rejects.toThrow(
        new AssistantToolError(`There is no open bid from ${provider} for group 1/1. Read the bids again with get_bids.`)
      );
    });

    it("refuses a choice of another provider's bid", async () => {
      const { service, bidController } = setup();
      bidController.list.mockResolvedValue({ data: [createBid({ dseq: "42", gseq: 1, oseq: 1 })] });

      await expect(propose(service, "choose_bid", { dseq: "42", choices: [{ gseq: 1, oseq: 1, provider: createAkashAddress() }] })).rejects.toThrow(
        AssistantToolError
      );
    });
  });

  describe("update_deployment", () => {
    it("shows each service before the patch, with env names only, and the manifest version to guard on", async () => {
      const { service, deploymentController } = setup();
      const deployment = createGetDeploymentResponseData({ dseq: "42", name: "site", manifestVersion: "mv1" });
      deploymentController.findByDseq.mockResolvedValue({ data: deployment });
      const patch = { image: "nginx:1.27.0", env: { DEBUG: "true", PORT: null, OLD_TOKEN: null } };

      const action = await propose(service, "update_deployment", { dseq: "42", services: { web: patch } });

      expect(deploymentController.findByDseq).toHaveBeenCalledWith("42");
      expect(action).toEqual({
        type: "update_deployment",
        tier: "confirm",
        dseq: "42",
        name: "site",
        manifestVersion: "mv1",
        services: [
          {
            service: "web",
            before: {
              image: "nginx:1.25.3",
              command: null,
              args: null,
              envKeys: ["PORT", "API_KEY"],
              expose: [{ port: 80, as: 80, accept: [], global: true }],
              storage: []
            },
            patch
          }
        ]
      });
    });

    it("refuses a service the SDL does not declare and names the ones it does", async () => {
      const { service } = setup();

      await expect(propose(service, "update_deployment", { dseq: "42", services: { api: { image: "a:1" } } })).rejects.toThrow(
        new AssistantToolError('The deployment has no service named "api". Its services are: web')
      );
    });

    it("refuses a value that looks like a secret and points to the secure card", async () => {
      const { service } = setup();

      await expect(propose(service, "update_deployment", { dseq: "42", services: { web: { env: { DEBUG: "1", HF_TOKEN: "hf_abc" } } } })).rejects.toThrow(
        new AssistantToolError("HF_TOKEN looks like a secret. Propose it with propose_set_secret so the user types the value in a secure input.")
      );
    });

    it("refuses a deployment Console holds no SDL for", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", sdl: null }) });

      await expect(propose(service, "update_deployment", { dseq: "42", services: { web: { image: "a:1" } } })).rejects.toThrow(
        new AssistantToolError("Console holds no readable SDL for deployment 42, so it cannot be changed from here.")
      );
    });

    it("refuses an SDL that does not parse", async () => {
      const { service, sdlService } = setup();
      sdlService.parse.mockReturnValue({ ok: false, value: [] });

      await expect(propose(service, "update_deployment", { dseq: "42", services: { web: { image: "a:1" } } })).rejects.toThrow(/no readable SDL/);
    });

    it("refuses a closed deployment", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", state: "closed" }) });

      await expect(propose(service, "update_deployment", { dseq: "42", services: { web: { image: "a:1" } } })).rejects.toThrow(
        new AssistantToolError("Deployment 42 is closed, not active.")
      );
    });
  });

  describe("secrets and registry credentials", () => {
    it("says whether a secret replaces a variable the service declares", async () => {
      const { service } = setup();

      expect(await propose(service, "set_secret", { dseq: "42", service: "web", name: "API_KEY" })).toEqual({
        type: "set_secret",
        tier: "confirm",
        dseq: "42",
        service: "web",
        name: "API_KEY",
        replacesExisting: true
      });
      expect(await propose(service, "set_secret", { dseq: "42", service: "web", name: "HF_TOKEN" })).toMatchObject({ replacesExisting: false });
    });

    it("refuses a secret for an unknown service", async () => {
      const { service } = setup();

      await expect(propose(service, "set_secret", { dseq: "42", service: "db", name: "X" })).rejects.toThrow(AssistantToolError);
    });

    it("shows the service's image beside the registry host", async () => {
      const { service } = setup();

      expect(await propose(service, "set_registry_credentials", { dseq: "42", service: "web", host: "ghcr.io" })).toEqual({
        type: "set_registry_credentials",
        tier: "confirm",
        dseq: "42",
        service: "web",
        image: "nginx:1.25.3",
        host: "ghcr.io",
        usernameHint: null
      });
      expect(await propose(service, "set_registry_credentials", { dseq: "42", service: "web", host: "ghcr.io", usernameHint: "me" })).toMatchObject({
        usernameHint: "me"
      });
    });

    it("refuses registry credentials for an unknown service", async () => {
      const { service } = setup();

      await expect(propose(service, "set_registry_credentials", { dseq: "42", service: "db", host: "ghcr.io" })).rejects.toThrow(AssistantToolError);
    });
  });

  describe("redeploy_with_resources", () => {
    it("shows the resources before and after, keeping what the change leaves out", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", sdl: GPU_SDL }) });

      const action = await propose(service, "redeploy_with_resources", {
        dseq: "42",
        reason: "OOMKilled",
        services: { web: { memory: "4Gi", storage: "20Gi", gpu: { units: 1 }, count: 2 } }
      });

      expect(action).toEqual({
        type: "redeploy_with_resources",
        tier: "deep_link",
        dseq: "42",
        reason: "OOMKilled",
        services: [
          {
            service: "web",
            before: { cpu: 1, memory: "1Gi", storage: ["2Gi"], gpu: { units: 2, models: ["nvidia/a100"] }, count: 1 },
            after: { cpu: 1, memory: "4Gi", storage: ["20Gi"], gpu: { units: 1, models: ["nvidia/a100"] }, count: 2 }
          }
        ]
      });
    });

    it("drops the gpu at zero units, takes new models and keeps unchanged fields", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", sdl: GPU_SDL }) });

      const dropped = await propose(service, "redeploy_with_resources", { dseq: "42", reason: "r", services: { web: { cpu: 2, gpu: { units: 0 } } } });
      const remodeled = await propose(service, "redeploy_with_resources", {
        dseq: "42",
        reason: "r",
        services: { web: { gpu: { units: 2, models: ["nvidia/h100"] } } }
      });

      expect(dropped).toMatchObject({ services: [{ after: { cpu: 2, memory: "1Gi", storage: ["2Gi"], gpu: null, count: 1 } }] });
      expect(remodeled).toMatchObject({ services: [{ after: { gpu: { units: 2, models: ["nvidia/h100"] } } }] });
    });

    it("adds a gpu without models to a service that had none", async () => {
      const { service } = setup();

      const action = await propose(service, "redeploy_with_resources", { dseq: "42", reason: "r", services: { web: { gpu: { units: 1 } } } });

      expect(action).toMatchObject({ services: [{ before: { gpu: null }, after: { gpu: { units: 1, models: [] } } }] });
    });

    it("refuses an unknown service", async () => {
      const { service } = setup();

      await expect(propose(service, "redeploy_with_resources", { dseq: "42", reason: "r", services: { db: { cpu: 1 } } })).rejects.toThrow(AssistantToolError);
    });
  });

  describe("housekeeping", () => {
    it("renames from the current name", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", name: "old" }) });

      expect(await propose(service, "rename_deployment", { dseq: "42", name: "new" })).toEqual({
        type: "rename_deployment",
        tier: "confirm",
        dseq: "42",
        from: "old",
        to: "new"
      });
    });

    it("adds hours to the current runtime limit and sends the new total", async () => {
      const { service, deploymentSettingController } = setup({ runtimeLimitHours: 24, runtimeEndsAt: "2026-11-05T00:00:00.000Z" });

      expect(await propose(service, "add_runtime_hours", { dseq: "42", hours: 48 })).toEqual({
        type: "add_runtime_hours",
        tier: "confirm",
        dseq: "42",
        hours: 48,
        currentLimitHours: 24,
        newLimitHours: 72,
        runtimeEndsAt: "2026-11-05T00:00:00.000Z"
      });
      expect(deploymentSettingController.findV2).toHaveBeenCalledWith({ dseq: "42" });
    });

    it("removes a runtime limit", async () => {
      const { service } = setup({ runtimeLimitHours: 12 });

      expect(await propose(service, "remove_runtime_limit", { dseq: "42" })).toEqual({
        type: "remove_runtime_limit",
        tier: "confirm",
        dseq: "42",
        currentLimitHours: 12
      });
    });

    it("refuses runtime changes on a deployment without a limit", async () => {
      const { service } = setup({ runtimeLimitHours: null });

      await expect(propose(service, "add_runtime_hours", { dseq: "42", hours: 1 })).rejects.toThrow(
        new AssistantToolError("This deployment has no runtime limit, so it already runs until it is closed.")
      );
      await expect(propose(service, "remove_runtime_limit", { dseq: "42" })).rejects.toThrow(
        new AssistantToolError("This deployment has no runtime limit to remove.")
      );
    });

    it("sends the manifest again only for an active deployment", async () => {
      const { service, deploymentController } = setup();

      expect(await propose(service, "send_manifest_again", { dseq: "42" })).toEqual({ type: "send_manifest_again", tier: "confirm", dseq: "42" });

      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", state: "closed" }) });
      await expect(propose(service, "send_manifest_again", { dseq: "42" })).rejects.toThrow(AssistantToolError);
    });

    it("proposes the deployment closed email alert only for an active deployment", async () => {
      const { service, deploymentController } = setup();

      expect(await propose(service, "create_alert", { dseq: "42" })).toEqual({
        type: "create_alert",
        tier: "confirm",
        alert: "deployment_closed",
        dseq: "42",
        channel: "email"
      });

      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", state: "closed" }) });
      await expect(propose(service, "create_alert", { dseq: "42" })).rejects.toThrow(new AssistantToolError("Deployment 42 is closed, not active."));
    });
  });

  describe("close_deployment", () => {
    it("marks the close destructive and carries the reason", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", name: "site" }) });

      expect(await propose(service, "close_deployment", { dseq: "42", reason: "cost_or_budget" })).toEqual({
        type: "close_deployment",
        tier: "destructive",
        dseq: "42",
        name: "site",
        reason: "cost_or_budget",
        reasonDetails: null
      });
      expect(await propose(service, "close_deployment", { dseq: "42", reason: "other", reasonDetails: "moving" })).toMatchObject({ reasonDetails: "moving" });
    });

    it("refuses to close a closed deployment", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", state: "closed" }) });

      await expect(propose(service, "close_deployment", { dseq: "42", reason: "other" })).rejects.toThrow(AssistantToolError);
    });

    it("lets a lookup refusal through", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockRejectedValue(createError(404, "Deployment not found"));

      await expect(propose(service, "close_deployment", { dseq: "42", reason: "other" })).rejects.toThrow("Deployment not found");
    });
  });

  describe("actions that need no lookup", () => {
    const projectId = "6f1f4b62-0a8c-4b8e-9a54-0c6b1a7d5c11";
    const provider = createAkashAddress();

    it.each<[ProposalActionType, Record<string, unknown>, Record<string, unknown>]>([
      ["move_deployment", { dseq: "42", projectId }, { type: "move_deployment", tier: "confirm", dseq: "42", projectId }],
      ["redeem_coupon", {}, { type: "redeem_coupon", tier: "confirm", code: null }],
      ["redeem_coupon", { code: "WELCOME" }, { type: "redeem_coupon", tier: "confirm", code: "WELCOME" }],
      ["save_as_template", { dseq: "42", title: "Site" }, { type: "save_as_template", tier: "confirm", dseq: "42", title: "Site", description: null }],
      [
        "save_as_template",
        { dseq: "42", title: "Site", description: "nginx" },
        { type: "save_as_template", tier: "confirm", dseq: "42", title: "Site", description: "nginx" }
      ],
      ["favorite_provider", { provider }, { type: "favorite_provider", tier: "confirm", provider }],
      [
        "request_hardware",
        { gpuModel: "h200", gpuCount: 8, interconnect: "server" },
        { type: "request_hardware", tier: "confirm", gpuModel: "h200", gpuCount: 8, interconnect: "server", notes: null }
      ],
      [
        "request_hardware",
        { gpuModel: "h200", gpuCount: 8, interconnect: "none", notes: "training" },
        { type: "request_hardware", tier: "confirm", gpuModel: "h200", gpuCount: 8, interconnect: "none", notes: "training" }
      ],
      ["buy_credits", {}, { type: "buy_credits", tier: "deep_link", amountUsd: null }],
      ["buy_credits", { amountUsd: 20 }, { type: "buy_credits", tier: "deep_link", amountUsd: 20 }],
      ["configure_auto_recharge", {}, { type: "configure_auto_recharge", tier: "deep_link", thresholdUsd: null, amountUsd: null }],
      ["configure_auto_recharge", { thresholdUsd: 5, amountUsd: 20 }, { type: "configure_auto_recharge", tier: "deep_link", thresholdUsd: 5, amountUsd: 20 }],
      ["open_in_editor", {}, { type: "open_in_editor", tier: "deep_link", dseq: null, templateId: null, sdl: null }],
      ["open_in_editor", { dseq: "42", templateId: "t", sdl: "s" }, { type: "open_in_editor", tier: "deep_link", dseq: "42", templateId: "t", sdl: "s" }]
    ])("builds %s from its arguments alone", async (type, args, expected) => {
      const { service, deploymentController } = setup();

      expect(await service.propose(type, args as ProposalArguments<typeof type>, { isTrialing: false })).toEqual(expected);
      expect(deploymentController.findByDseq).not.toHaveBeenCalled();
    });
  });

  function propose<T extends ProposalActionType>(
    service: AssistantProposalService,
    type: T,
    args: ProposalArguments<T>,
    context: { isTrialing: boolean | null } = { isTrialing: false }
  ) {
    return service.propose(type, args, context);
  }

  function setup(input: { runtimeLimitHours?: number | null; runtimeEndsAt?: string | null } = {}) {
    const deploymentController = mock<DeploymentController>();
    deploymentController.findByDseq.mockImplementation(async dseq => ({ data: createGetDeploymentResponseData({ dseq }) }));
    const deploymentSettingController = mock<DeploymentSettingController>();
    deploymentSettingController.findV2.mockResolvedValue({
      data: mock<DeploymentSetting>({ runtimeLimitHours: input.runtimeLimitHours ?? null, runtimeEndsAt: input.runtimeEndsAt ?? null })
    });
    const bidController = mock<BidController>();
    const templateController = mock<TemplateController>();
    const sdlService = mock<SdlService>();
    sdlService.parse.mockImplementation(sdl => ({ ok: true, value: yaml.raw(sdl) }));
    const bidScreeningHttpService = mock<BidScreeningHttpService>();
    const service = new AssistantProposalService(
      deploymentController,
      deploymentSettingController,
      bidController,
      templateController,
      sdlService,
      bidScreeningHttpService
    );

    return { service, deploymentController, deploymentSettingController, bidController, templateController, sdlService, bidScreeningHttpService };
  }
});
