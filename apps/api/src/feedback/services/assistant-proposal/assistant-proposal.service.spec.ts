import { generateManifest, yaml } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidController } from "@src/bid/controllers/bid/bid.controller";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import type { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import type { DeploymentSetting } from "@src/deployment/http-schemas/deployment-setting.schema";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { AssistantActionOf } from "@src/feedback/http-schemas/assistant-action.schema";
import { AssistantProposalWithheldError, AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { ProposalActionType, ProposalArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import type { AssistantAccountToolsService } from "@src/feedback/services/assistant-account-tools/assistant-account-tools.service";
import type { AssistantBidToolsService, SdlAvailability } from "@src/feedback/services/assistant-bid-tools/assistant-bid-tools.service";
import { PricingService } from "@src/pricing/services/pricing/pricing.service";
import { AssistantProposalService, type ProposalContext } from "./assistant-proposal.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { ASSISTANT_TEST_SDL, createGetDeploymentResponseData } from "@test/seeders/get-deployment-response.seeder";

const GPU_SDL = ASSISTANT_TEST_SDL.replace(
  "        storage:\n          size: 2Gi",
  "        storage:\n          size: 2Gi\n        gpu:\n          units: 2\n          attributes:\n            vendor:\n              nvidia:\n                - model: a100"
);

const PLACED_SDL = ASSISTANT_TEST_SDL.replace("    dcloud:\n      pricing:", "    dcloud:\n      attributes:\n        host: akash\n      pricing:");

const SHARED_PROFILE_SDL = ASSISTANT_TEST_SDL.replace(
  "deployment:\n  web:\n    dcloud:\n      profile: web\n      count: 1\n",
  "deployment:\n  web:\n    dcloud:\n      profile: web\n      count: 1\n  api:\n    dcloud:\n      profile: web\n      count: 1\n"
);

const CRAZY_PRICED_SDL = ASSISTANT_TEST_SDL.replace(
  "    dcloud:\n      pricing:\n        web:\n          denom: uact\n          amount: 1000\n",
  "    dcloud:\n      pricing:\n        web:\n          denom: uakt\n          amount: 999999999999\n        db:\n          denom: usd\n          amount: -1\n    backup:\n      pricing:\n        web:\n          denom: uact\n          amount: 1\n"
).replace(
  "deployment:\n  web:\n    dcloud:\n      profile: web\n      count: 1\n",
  "deployment:\n  web:\n    dcloud:\n      profile: web\n      count: 1\n    backup:\n      profile: web\n      count: 1\n  db:\n    dcloud:\n      profile: db\n      count: 1\n"
);

const DEFAULT_CEILING = { denom: "uact", amount: 100000 };

const RENAMED_PLACEMENT_SDL = ASSISTANT_TEST_SDL.replace("  placement:\n    dcloud:", "  placement:\n    akash:").replace(
  "deployment:\n  web:\n    dcloud:",
  "deployment:\n  web:\n    akash:"
);

const CHANGED_PRICING_MESSAGE =
  "This SDL changes the price or denom of the template or deployment it is based on. Keep its pricing exactly and change only placement attributes or resources, or pick another template by templateId.";

function pricingOf(sdl: string | null) {
  const { profiles } = yaml.raw(sdl!) as { profiles: { placement: Record<string, { pricing: unknown }> } };
  return Object.fromEntries(Object.entries(profiles.placement).map(([name, { pricing }]) => [name, pricing]));
}

function availabilityOf(providersAbleToBid: number | null, reason?: string): SdlAvailability {
  return {
    providersAbleToBid,
    groups: [{ group: "dcloud", requestedGpus: [], providersAbleToBid, ...(reason && { reason }) }],
    gpuModelsWithFreeCapacity: null
  };
}

describe(AssistantProposalService.name, () => {
  describe("create_deployment", () => {
    it("screens a template's SDL as a trial would and shows how many providers could bid", async () => {
      const { service, accountTools, bidTools } = setup();
      accountTools.templateSdl.mockResolvedValue(ASSISTANT_TEST_SDL);
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(3));

      const action = await propose(service, "create_deployment", { templateId: "hello-world" }, { isTrialing: true, withheldTemplateSdls: [] });

      expect(accountTools.templateSdl).toHaveBeenCalledWith("hello-world");
      expect(bidTools.checkAvailability).toHaveBeenCalledWith(ASSISTANT_TEST_SDL, { isTrialing: true });
      expect(action).toEqual({
        type: "create_deployment",
        tier: "confirm",
        templateId: "hello-world",
        sdl: ASSISTANT_TEST_SDL,
        name: null,
        runtimeLimitHours: null,
        services: [{ service: "web", image: "nginx:1.25.3", resources: { cpu: 1, memory: "1Gi", storage: ["2Gi"], gpu: null, count: 1 } }],
        providersAbleToBid: 3,
        cost: { estimatedUsdPerMonth: 6.01 }
      });
    });

    it("gives a GPU deployment no estimate", async () => {
      const { service, accountTools } = setup();
      accountTools.templateSdl.mockResolvedValue(GPU_SDL);

      const action = await propose(service, "create_deployment", { templateId: "gpu" });

      expect(action.cost).toEqual({ estimatedUsdPerMonth: null });
    });

    it("shows no cost when the SDL builds no manifest", async () => {
      const { service, accountTools, sdlService } = setup();
      accountTools.templateSdl.mockResolvedValue(ASSISTANT_TEST_SDL);
      sdlService.generateManifest.mockResolvedValue({ ok: false, value: [] });

      expect((await propose(service, "create_deployment", { templateId: "hello-world" })).cost).toBeNull();
    });

    it("takes a generated SDL with a name and runtime limit, and shows no count when screening does not answer", async () => {
      const { service, bidTools } = setup();
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(null));

      const action = await propose(
        service,
        "create_deployment",
        { sdl: ASSISTANT_TEST_SDL, name: "web", runtimeLimitHours: 12 },
        { isTrialing: null, withheldTemplateSdls: [] }
      );

      expect(bidTools.checkAvailability).toHaveBeenCalledWith(action.sdl, { isTrialing: false });
      expect(action).toMatchObject({ templateId: null, name: "web", runtimeLimitHours: 12, providersAbleToBid: null });
    });

    it("prices every deployed service of a generated SDL at Console's default ceiling and screens that SDL", async () => {
      const { service, bidTools } = setup();

      const action = await propose(service, "create_deployment", { sdl: CRAZY_PRICED_SDL });

      expect(pricingOf(action.sdl)).toEqual({
        dcloud: { web: DEFAULT_CEILING, db: DEFAULT_CEILING },
        backup: { web: DEFAULT_CEILING }
      });
      expect(bidTools.checkAvailability).toHaveBeenCalledWith(action.sdl, { isTrialing: false });
    });

    it("restates a generated SDL's uakt price as the default uact ceiling", async () => {
      const { service } = setup();

      const action = await propose(service, "create_deployment", { sdl: ASSISTANT_TEST_SDL.replace("denom: uact", "denom: uakt") });

      expect(pricingOf(action.sdl)).toEqual({ dcloud: { web: DEFAULT_CEILING } });
    });

    it("keeps a template's own pricing when it is deployed as is", async () => {
      const { service, accountTools } = setup();
      accountTools.templateSdl.mockResolvedValue(CRAZY_PRICED_SDL);

      const action = await propose(service, "create_deployment", { templateId: "pricey" });

      expect(action.sdl).toBe(CRAZY_PRICED_SDL);
    });

    it("lists no services for an SDL the summary cannot read", async () => {
      const { service, sdlService } = setup();
      sdlService.parse.mockReturnValue({ ok: false, value: [] });

      expect(await propose(service, "create_deployment", { sdl: "x" })).toMatchObject({ services: [] });
    });

    it("lets a refusal of the SDL through", async () => {
      const { service, bidTools } = setup();
      bidTools.checkAvailability.mockRejectedValue(new AssistantToolError("The SDL is not valid: bad indent"));

      await expect(propose(service, "create_deployment", { sdl: "bad" })).rejects.toThrow(new AssistantToolError("The SDL is not valid: bad indent"));
      expect(bidTools.checkAvailability).toHaveBeenCalledWith("bad", { isTrialing: false });
    });

    it("holds back a template no provider can bid on, with the reason and the template's SDL to adjust", async () => {
      const { service, accountTools, bidTools } = setup();
      accountTools.templateSdl.mockResolvedValue(PLACED_SDL);
      const availability = availabilityOf(0, "No audited provider has signed the placement attributes host=akash.");
      bidTools.checkAvailability.mockResolvedValue(availability);
      const context = { isTrialing: false, withheldTemplateSdls: [] };

      const error = await propose(service, "create_deployment", { templateId: "akash-network-awesome-akash-dart" }, context).catch(caught => caught);

      expect(error).toBeInstanceOf(AssistantProposalWithheldError);
      expect(error.feedback).toEqual({ ...availability, templateSdl: PLACED_SDL });
      expect(context.withheldTemplateSdls).toEqual([PLACED_SDL]);
    });

    it("deploys the generated SDL at the default ceiling and keeps the template it came from when both are given", async () => {
      const { service, accountTools, bidTools } = setup();
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(4));

      const action = await propose(service, "create_deployment", { templateId: "hello-world", sdl: CRAZY_PRICED_SDL });

      expect(accountTools.templateSdl).not.toHaveBeenCalled();
      expect(pricingOf(action.sdl)).toEqual({ dcloud: { web: DEFAULT_CEILING, db: DEFAULT_CEILING }, backup: { web: DEFAULT_CEILING } });
      expect(bidTools.checkAvailability).toHaveBeenCalledWith(action.sdl, { isTrialing: false });
      expect(action).toMatchObject({ templateId: "hello-world", providersAbleToBid: 4 });
    });

    it("holds back a generated SDL given with a template without repeating it or treating it as the template's", async () => {
      const { service, bidTools } = setup();
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(0));
      const context = { isTrialing: false, withheldTemplateSdls: [] };

      const error = await propose(service, "create_deployment", { templateId: "hello-world", sdl: ASSISTANT_TEST_SDL }, context).catch(caught => caught);

      expect(error.feedback).toEqual(availabilityOf(0));
      expect(context.withheldTemplateSdls).toEqual([]);
    });

    it("holds back a generated SDL without repeating or remembering it", async () => {
      const { service, bidTools } = setup();
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(0));
      const context = { isTrialing: false, withheldTemplateSdls: [] };

      const error = await propose(service, "create_deployment", { sdl: ASSISTANT_TEST_SDL }, context).catch(caught => caught);

      expect(error.feedback).toEqual(availabilityOf(0));
      expect(context.withheldTemplateSdls).toEqual([]);
    });

    it("proposes an SDL adjusted from a held-back template as is, keeping the template's pricing", async () => {
      const { service, bidTools } = setup();
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(5));
      const adjusted = PLACED_SDL.replace("      attributes:\n        host: akash\n", "");

      const action = await propose(service, "create_deployment", { sdl: adjusted }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] });

      expect(action).toMatchObject({ sdl: adjusted, providersAbleToBid: 5 });
      expect(bidTools.checkAvailability).toHaveBeenCalledWith(adjusted, { isTrialing: false });
    });

    it.each([
      ["price", PLACED_SDL.replace("amount: 1000", "amount: 5000")],
      ["denom", PLACED_SDL.replace("denom: uact", "denom: uakt")],
      [
        "dearer placement listed first",
        ASSISTANT_TEST_SDL.replace(
          "  placement:\n",
          "  placement:\n    dear:\n      pricing:\n        web:\n          denom: uact\n          amount: 99999\n"
        ).replace("deployment:\n  web:\n    dcloud:", "deployment:\n  web:\n    dear:")
      ],
      ["unreadable", "services: ["]
    ])("refuses an SDL that changes the pricing (%s) of the template held back", async (_, adjusted) => {
      const { service, bidTools } = setup();

      await expect(propose(service, "create_deployment", { sdl: adjusted }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] })).rejects.toThrow(
        new AssistantToolError(CHANGED_PRICING_MESSAGE)
      );
      expect(bidTools.checkAvailability).not.toHaveBeenCalled();
    });

    it("compares against the template held back last", async () => {
      const { service } = setup();
      const repriced = PLACED_SDL.replace("amount: 1000", "amount: 5000");

      const action = await propose(service, "create_deployment", { sdl: repriced }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL, repriced] });

      expect(action.sdl).toBe(repriced);
    });

    it("refuses a repriced SDL after a hold back even when a templateId comes with it", async () => {
      const { service, accountTools, bidTools } = setup();
      const repriced = PLACED_SDL.replace("amount: 1000", "amount: 5000");

      await expect(
        propose(service, "create_deployment", { templateId: "hello-world", sdl: repriced }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] })
      ).rejects.toThrow(AssistantToolError);
      expect(accountTools.templateSdl).not.toHaveBeenCalled();
      expect(bidTools.checkAvailability).not.toHaveBeenCalled();
    });

    it("lets another template replace one held back", async () => {
      const { service, accountTools, bidTools } = setup();
      accountTools.templateSdl.mockResolvedValue(ASSISTANT_TEST_SDL);
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(9));

      const action = await propose(service, "create_deployment", { templateId: "hello-world" }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] });

      expect(action).toMatchObject({ templateId: "hello-world", providersAbleToBid: 9 });
    });
  });

  describe("pricedSdl", () => {
    it("prices an SDL the model wrote at the default ceiling", () => {
      const { service } = setup();

      expect(pricingOf(service.pricedSdl(CRAZY_PRICED_SDL, { isTrialing: false, withheldTemplateSdls: [] }))).toEqual({
        dcloud: { web: DEFAULT_CEILING, db: DEFAULT_CEILING },
        backup: { web: DEFAULT_CEILING }
      });
    });
  });

  describe("open_in_editor", () => {
    it("prices an SDL the model wrote at the default ceiling", async () => {
      const { service, deploymentController, accountTools } = setup();

      const action = await propose(service, "open_in_editor", { sdl: CRAZY_PRICED_SDL });

      expect(action).toMatchObject({ type: "open_in_editor", tier: "deep_link", dseq: null, templateId: null });
      expect(pricingOf(action.sdl)).toEqual({
        dcloud: { web: DEFAULT_CEILING, db: DEFAULT_CEILING },
        backup: { web: DEFAULT_CEILING }
      });
      expect(deploymentController.findByDseq).not.toHaveBeenCalled();
      expect(accountTools.templateSdl).not.toHaveBeenCalled();
    });

    it("refuses to open an SDL that changes the pricing of the template held back", async () => {
      const { service } = setup();
      const repriced = PLACED_SDL.replace("amount: 1000", "amount: 5000");

      await expect(propose(service, "open_in_editor", { sdl: repriced }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] })).rejects.toThrow(
        new AssistantToolError(CHANGED_PRICING_MESSAGE)
      );
    });

    it("opens an adjusted SDL that keeps the pricing of the template held back", async () => {
      const { service } = setup();
      const adjusted = PLACED_SDL.replace("      attributes:\n        host: akash\n", "");

      expect(await propose(service, "open_in_editor", { sdl: adjusted }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] })).toEqual({
        type: "open_in_editor",
        tier: "deep_link",
        dseq: null,
        templateId: null,
        sdl: adjusted
      });
    });

    it("opens an edit of an existing deployment that keeps its pricing, as is", async () => {
      const { service, deploymentController } = setup();
      const edited = ASSISTANT_TEST_SDL.replace("nginx:1.25.3", "nginx:1.27.0");

      expect(await propose(service, "open_in_editor", { dseq: "42", templateId: "hello-world", sdl: edited })).toEqual({
        type: "open_in_editor",
        tier: "deep_link",
        dseq: "42",
        templateId: "hello-world",
        sdl: edited
      });
      expect(deploymentController.findByDseq).toHaveBeenCalledWith("42");
    });

    it.each([
      ["price", ASSISTANT_TEST_SDL.replace("amount: 1000", "amount: 100000")],
      ["denom", ASSISTANT_TEST_SDL.replace("denom: uact", "denom: uakt")],
      ["placement name, as the card would", RENAMED_PLACEMENT_SDL],
      ["unreadable", "services: ["]
    ])("refuses an edit of an existing deployment that changes its %s", async (_, edited) => {
      const { service } = setup();

      await expect(propose(service, "open_in_editor", { dseq: "42", sdl: edited })).rejects.toThrow(new AssistantToolError(CHANGED_PRICING_MESSAGE));
    });

    it("refuses an edit of a deployment Console holds no SDL for", async () => {
      const { service, deploymentController } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", sdl: null }) });

      await expect(propose(service, "open_in_editor", { dseq: "42", sdl: ASSISTANT_TEST_SDL })).rejects.toThrow(
        new AssistantToolError("Console holds no readable SDL for deployment 42, so it cannot be changed from here.")
      );
    });

    it("opens an edit of a template that keeps its pricing, as is", async () => {
      const { service, accountTools } = setup();
      accountTools.templateSdl.mockResolvedValue(PLACED_SDL);
      const edited = PLACED_SDL.replace("      attributes:\n        host: akash\n", "");

      expect(await propose(service, "open_in_editor", { templateId: "dart", sdl: edited })).toMatchObject({ templateId: "dart", sdl: edited });
      expect(accountTools.templateSdl).toHaveBeenCalledWith("dart");
    });

    it("opens an edit of a template that renames its placement at the same price", async () => {
      const { service, accountTools } = setup();
      accountTools.templateSdl.mockResolvedValue(ASSISTANT_TEST_SDL);

      expect(await propose(service, "open_in_editor", { templateId: "hello-world", sdl: RENAMED_PLACEMENT_SDL })).toMatchObject({ sdl: RENAMED_PLACEMENT_SDL });
    });

    it("refuses an edit of a template that changes its pricing", async () => {
      const { service, accountTools } = setup();
      accountTools.templateSdl.mockResolvedValue(PLACED_SDL);

      await expect(propose(service, "open_in_editor", { templateId: "dart", sdl: CRAZY_PRICED_SDL })).rejects.toThrow(
        new AssistantToolError(CHANGED_PRICING_MESSAGE)
      );
    });

    it("opens a template or deployment without a lookup when the model sends no SDL", async () => {
      const { service, deploymentController, accountTools } = setup();

      expect(await propose(service, "open_in_editor", { templateId: "hello-world" }, { isTrialing: false, withheldTemplateSdls: [PLACED_SDL] })).toMatchObject({
        templateId: "hello-world",
        sdl: null
      });
      expect(await propose(service, "open_in_editor", { dseq: "42" })).toMatchObject({ dseq: "42", sdl: null });
      expect(deploymentController.findByDseq).not.toHaveBeenCalled();
      expect(accountTools.templateSdl).not.toHaveBeenCalled();
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
        ],
        providersAbleToBid: 2
      });
    });

    it("screens the SDL with the new resources, leaving its pricing alone", async () => {
      const { service, bidTools } = setup();

      await propose(
        service,
        "redeploy_with_resources",
        { dseq: "42", reason: "OOMKilled", services: { web: { memory: "4Gi" } } },
        { isTrialing: true, withheldTemplateSdls: [] }
      );

      const [screenedSdl, options] = bidTools.checkAvailability.mock.calls[0];
      expect(options).toEqual({ isTrialing: true });
      expect(yaml.raw(screenedSdl)).toMatchObject({
        profiles: { compute: { web: { resources: { memory: { size: "4Gi" } } } }, placement: { dcloud: { pricing: { web: { denom: "uact", amount: 1000 } } } } }
      });
    });

    it("holds back new resources no provider can bid on", async () => {
      const { service, bidTools } = setup();
      bidTools.checkAvailability.mockResolvedValue(availabilityOf(0, "No provider has nvidia/h200 free right now."));

      const error = await propose(service, "redeploy_with_resources", {
        dseq: "42",
        reason: "r",
        services: { web: { gpu: { units: 8, models: ["nvidia/h200"] } } }
      }).catch(caught => caught);

      expect(error).toBeInstanceOf(AssistantProposalWithheldError);
      expect(error.feedback).toEqual(availabilityOf(0, "No provider has nvidia/h200 free right now."));
    });

    it("shows no count for a compute profile two services share", async () => {
      const { service, deploymentController, bidTools } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", sdl: SHARED_PROFILE_SDL }) });

      const action = await propose(service, "redeploy_with_resources", { dseq: "42", reason: "r", services: { web: { cpu: 2 } } });

      expect(action).toMatchObject({ providersAbleToBid: null });
      expect(bidTools.checkAvailability).not.toHaveBeenCalled();
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
      [
        "edit_configure_form",
        { reason: "9 providers offer SSD", services: { web: { persistentStorage: { class: "beta2" } } }, placements: { dcloud: { attributes: [] } } },
        {
          type: "edit_configure_form",
          tier: "confirm",
          reason: "9 providers offer SSD",
          services: [{ service: "web", changes: { persistentStorage: { class: "beta2" } } }],
          placements: [{ placement: "dcloud", changes: { attributes: [] } }]
        }
      ],
      [
        "edit_configure_form",
        { reason: "No persistent storage on this network", services: { web: { persistentStorage: { remove: true } } } },
        {
          type: "edit_configure_form",
          tier: "confirm",
          reason: "No persistent storage on this network",
          services: [{ service: "web", changes: { persistentStorage: { remove: true } } }],
          placements: []
        }
      ],
      [
        "edit_configure_form",
        { reason: "Any region", placements: { dcloud: { regions: [] } } },
        { type: "edit_configure_form", tier: "confirm", reason: "Any region", services: [], placements: [{ placement: "dcloud", changes: { regions: [] } }] }
      ]
    ])("builds %s from its arguments alone", async (type, args, expected) => {
      const { service, deploymentController } = setup();

      expect(await service.propose(type, args as ProposalArguments<typeof type>, { isTrialing: false, withheldTemplateSdls: [] })).toEqual(expected);
      expect(deploymentController.findByDseq).not.toHaveBeenCalled();
    });
  });

  function propose<T extends ProposalActionType>(
    service: AssistantProposalService,
    type: T,
    args: ProposalArguments<T>,
    context: ProposalContext = { isTrialing: false, withheldTemplateSdls: [] }
  ) {
    return service.propose(type, args, context) as Promise<AssistantActionOf<T>>;
  }

  function setup(input: { runtimeLimitHours?: number | null; runtimeEndsAt?: string | null } = {}) {
    const deploymentController = mock<DeploymentController>();
    deploymentController.findByDseq.mockImplementation(async dseq => ({ data: createGetDeploymentResponseData({ dseq }) }));
    const deploymentSettingController = mock<DeploymentSettingController>();
    deploymentSettingController.findV2.mockResolvedValue({
      data: mock<DeploymentSetting>({ runtimeLimitHours: input.runtimeLimitHours ?? null, runtimeEndsAt: input.runtimeEndsAt ?? null })
    });
    const bidController = mock<BidController>();
    const sdlService = mock<SdlService>();
    sdlService.parse.mockImplementation(sdl => ({ ok: true, value: yaml.raw(sdl) }));
    sdlService.generateManifest.mockImplementation(async sdl => generateManifest(yaml.raw(sdl) as Parameters<typeof generateManifest>[0]));
    const accountTools = mock<AssistantAccountToolsService>();
    const bidTools = mock<AssistantBidToolsService>();
    bidTools.checkAvailability.mockResolvedValue(availabilityOf(2));
    const service = new AssistantProposalService(
      deploymentController,
      deploymentSettingController,
      bidController,
      sdlService,
      accountTools,
      bidTools,
      new PricingService()
    );

    return { service, deploymentController, deploymentSettingController, bidController, sdlService, accountTools, bidTools };
  }
});
