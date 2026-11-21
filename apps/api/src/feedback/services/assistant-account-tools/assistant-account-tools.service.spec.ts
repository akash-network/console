import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import type { WalletSettingController } from "@src/billing/controllers/wallet-settings/wallet-settings.controller";
import type { WalletSettingsResponse } from "@src/billing/http-schemas/wallet.schema";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";
import type { TemplateController } from "@src/template/controllers/template/template.controller";
import type { Template } from "@src/template/types/template";
import type { CommunityTemplateCard, CommunityTemplateService } from "@src/template-marketplace/services/community-template/community-template.service";
import type { UserOutput } from "@src/user/repositories";
import { AssistantAccountToolsService } from "./assistant-account-tools.service";

const MARKETPLACE_ID = "3f2c9a54-7d1e-4b8a-9c61-0e5d2a7b4f10";

const GALLERY = {
  data: [
    {
      title: "AI - GPU",
      templates: [
        {
          id: "llama-3-8b",
          name: "Llama 3 8B",
          summary: "Serve Llama with vLLM",
          hardware: { cpu: 8, memoryBytes: 1, storageBytes: 1, gpu: { units: 1, models: ["a100"] } }
        },
        { id: "comfyui", name: "ComfyUI", summary: null, tags: ["recommended"] }
      ]
    },
    {
      title: "Web",
      templates: [
        { id: "nginx", name: "Nginx", summary: "Static site".repeat(40), tags: ["popular"] },
        { id: "akash-network-awesome-akash-dart", name: "Dart", summary: "A hello world web server written in Dart" }
      ]
    }
  ]
};

describe(AssistantAccountToolsService.name, () => {
  describe("getBalanceAndSpend", () => {
    it("reads the balance, trial, spend and auto recharge of the signed-in user", async () => {
      const { service, walletController, walletSettingController, deploymentController } = setup();
      walletController.getWallets.mockResolvedValue({
        data: [
          {
            id: 1,
            userId: "user-1",
            creditAmount: 99_497_947,
            address: "akash1",
            denom: "uact",
            isTrialing: true,
            isTrialRefused: false,
            trialEndsAt: new Date("2026-12-01T00:00:00.000Z"),
            trialDurationDays: 30,
            topUpMinAmountUsd: 20,
            createdAt: new Date()
          }
        ]
      });
      walletSettingController.getWalletSettings.mockResolvedValue({
        data: mock<WalletSettingsResponse["data"]>({ autoReloadEnabled: true, autoReloadThreshold: 5, autoReloadAmount: 20 })
      });
      deploymentController.getSpendRate.mockResolvedValue({
        data: {
          deployments: [
            { dseq: "42", price: { denom: "uact", amount: "1" } },
            { dseq: "43", price: { denom: "uact", amount: "2.93" } },
            { dseq: "42", price: { denom: "uact", amount: "2" } }
          ]
        }
      });
      deploymentController.findNames.mockResolvedValue({ data: { "42": "site", "43": null } });
      deploymentController.getWeeklyDeploymentCost.mockResolvedValue({ data: { weeklyCost: 3.5 } });

      const result = await service.getBalanceAndSpend({});

      expect(walletController.getWallets).toHaveBeenCalledWith({ userId: "user-1" });
      expect(deploymentController.findNames).toHaveBeenCalledWith(["42", "43"]);
      expect(result).toEqual({
        creditBalanceUsd: 99.5,
        isTrialing: true,
        trialEndsAt: new Date("2026-12-01T00:00:00.000Z"),
        weeklyCostUsd: 3.5,
        spendByDeployment: [
          { dseq: "42", name: "site", usdPerMonth: 1.31 },
          { dseq: "43", name: null, usdPerMonth: 1.28 }
        ],
        autoRecharge: { enabled: true, thresholdUsd: 5, amountUsd: 20 }
      });
    });

    it("reports what it could not read as unknown, and auto recharge off without settings", async () => {
      const { service, walletController, walletSettingController, deploymentController } = setup();
      walletController.getWallets.mockResolvedValue({ data: [] });
      walletSettingController.getWalletSettings.mockRejectedValue(createError(404, "WalletSetting Not Found"));
      deploymentController.getSpendRate.mockRejectedValue(createError(403, "Wallet not initialized"));
      deploymentController.getWeeklyDeploymentCost.mockRejectedValue(createError(404));

      expect(await service.getBalanceAndSpend({})).toEqual({
        creditBalanceUsd: null,
        isTrialing: null,
        trialEndsAt: null,
        weeklyCostUsd: null,
        spendByDeployment: null,
        autoRecharge: { enabled: false }
      });
    });

    it("lists the spend without names when they cannot be read", async () => {
      const { service, walletController, deploymentController } = setup();
      walletController.getWallets.mockResolvedValue({ data: [] });
      deploymentController.getSpendRate.mockResolvedValue({ data: { deployments: [{ dseq: "42", price: { denom: "uact", amount: "2.93" } }] } });
      deploymentController.findNames.mockRejectedValue(createError(404, "UserWallet Not Found"));

      const { spendByDeployment } = await service.getBalanceAndSpend({});

      expect(spendByDeployment).toEqual([{ dseq: "42", name: null, usdPerMonth: 1.28 }]);
    });

    it("lets server failures through", async () => {
      const { service, walletController } = setup();
      walletController.getWallets.mockRejectedValue(createError(500, "boom"));

      await expect(service.getBalanceAndSpend({})).rejects.toThrow("boom");
    });

    it("lets failures that are not http errors through", async () => {
      const { service, walletController } = setup();
      walletController.getWallets.mockRejectedValue(new Error("db down"));

      await expect(service.getBalanceAndSpend({})).rejects.toThrow("db down");
    });
  });

  describe("listTemplates", () => {
    it("ranks templates by how many query words they match, with a short summary and gpu needs", async () => {
      const { service } = setup();

      const { templates } = await service.listTemplates({ query: "llama vllm gpu" });

      expect(templates).toEqual([
        {
          id: "llama-3-8b",
          name: "Llama 3 8B",
          category: "AI - GPU",
          source: "community",
          summary: "Serve Llama with vLLM",
          gpu: { units: 1, models: ["a100"] }
        },
        { id: "comfyui", name: "ComfyUI", category: "AI - GPU", source: "console_curated", summary: "", gpu: null }
      ]);
    });

    it("ranks Console's own hello world above a community template that matches as well", async () => {
      const { service } = setup();

      const { templates } = await service.listTemplates({ query: "deploy a hello world" });

      expect(templates.map(({ id, source }) => ({ id, source }))).toEqual([
        { id: "hello-world", source: "console" },
        { id: "akash-network-awesome-akash-dart", source: "community" }
      ]);
    });

    it("ranks a curated template above a community one that matches as well", async () => {
      const { service } = setup();

      const { templates } = await service.listTemplates({ query: "web" });

      expect(templates.map(({ id }) => id)).toEqual(["hello-world", "nginx", "akash-network-awesome-akash-dart"]);
    });

    it("ranks a community template first when it matches clearly better", async () => {
      const { service } = setup();

      const { templates } = await service.listTemplates({ query: "dart hello world server" });

      expect(templates.map(({ id }) => id)).toEqual(["akash-network-awesome-akash-dart", "hello-world"]);
    });

    it("lists Console's own templates, then the gallery in order without a query, and trims long summaries", async () => {
      const { service } = setup();

      const { templates } = await service.listTemplates({});

      expect(templates.map(({ id }) => id)).toEqual(["hello-world", "llama-3-8b", "comfyui", "nginx", "akash-network-awesome-akash-dart"]);
      expect(templates[3].summary).toHaveLength(200);
    });

    it("parses the gallery once until it is rebuilt", async () => {
      const { service, templateController } = setup();
      const parse = (await service.listTemplates({ query: "nginx" })).templates;

      expect(await service.listTemplates({ query: "nginx" })).toEqual({ templates: parse });
      templateController.getTemplatesListJson.mockResolvedValue(
        Buffer.from(JSON.stringify({ data: [{ title: "New", templates: [{ id: "nginx-2", name: "Nginx 2" }] }] }))
      );
      expect((await service.listTemplates({ query: "nginx" })).templates.map(({ id }) => id)).toEqual(["nginx-2"]);
    });

    it("finds nothing for unmatched words", async () => {
      const { service } = setup();

      expect(await service.listTemplates({ query: "kubernetes" })).toEqual({ templates: [] });
    });

    it("searches no community template while the template marketplace is off, even when asked to", async () => {
      const { service, communityTemplateService } = setup({ cards: [createCard({ title: "Dart server kit" })] });

      const { templates } = await service.listTemplates({ query: "dart", includeCommunity: true });

      expect(templates).toEqual([
        {
          id: "akash-network-awesome-akash-dart",
          name: "Dart",
          category: "Web",
          source: "community",
          summary: "A hello world web server written in Dart",
          gpu: null
        }
      ]);
      expect(communityTemplateService.getGallery).not.toHaveBeenCalled();
    });

    describe("when the template marketplace is on", () => {
      it("says of every template whether Akash reviewed it, and calls a gallery template nobody curated official", async () => {
        const { service } = setup({ isMarketplaceOn: true });

        const { templates } = await service.listTemplates({});

        expect(templates.map(({ id, source, reviewedByAkash }) => ({ id, source, reviewedByAkash }))).toEqual([
          { id: "hello-world", source: "console", reviewedByAkash: true },
          { id: "llama-3-8b", source: "official", reviewedByAkash: true },
          { id: "comfyui", source: "console_curated", reviewedByAkash: true },
          { id: "nginx", source: "console_curated", reviewedByAkash: true },
          { id: "akash-network-awesome-akash-dart", source: "official", reviewedByAkash: true }
        ]);
        expect(templates[0]).not.toHaveProperty("publisher");
      });

      it("suggests the templates Akash promoted and leaves out the community ones unless asked for them", async () => {
        const promoted = createCard({ title: "Dart API starter", isOfficial: true, publisher: { name: "Akash Labs", handle: "akash-labs", verified: true } });
        const community = createCard({ title: "Dart game server" });
        const { service } = setup({ isMarketplaceOn: true, cards: [promoted, community] });

        const { templates } = await service.listTemplates({ query: "dart" });

        expect(templates.map(({ id }) => id)).toEqual(["akash-network-awesome-akash-dart", promoted.id]);
        expect(templates[1]).toEqual({
          id: promoted.id,
          name: "Dart API starter",
          category: "Web",
          source: "official",
          reviewedByAkash: true,
          summary: "Runs a small web service",
          gpu: null,
          publisher: "Akash Labs"
        });
      });

      it("lists a community template when asked, as not reviewed by Akash, under its publisher's name", async () => {
        const community = createCard({
          title: "Dart game server",
          summary: "Realtime rooms",
          categories: ["Games", "Web"],
          resources: { cpu: 4, memoryBytes: 1, storageBytes: 1, gpu: { units: 2, models: ["a100"] } }
        });
        const { service } = setup({ isMarketplaceOn: true, cards: [community] });

        const { templates } = await service.listTemplates({ query: "realtime games", includeCommunity: true });

        expect(templates).toEqual([
          {
            id: community.id,
            name: "Dart game server",
            category: "Games",
            source: "community",
            reviewedByAkash: false,
            summary: "Realtime rooms",
            gpu: { units: 2, models: ["a100"] },
            publisher: "Lambda Garage"
          }
        ]);
      });

      it("leaves out community templates when the request says not to include them", async () => {
        const { service } = setup({ isMarketplaceOn: true, cards: [createCard({ title: "Dart game server" })] });

        const { templates } = await service.listTemplates({ query: "dart game", includeCommunity: false });

        expect(templates.map(({ id }) => id)).toEqual(["akash-network-awesome-akash-dart"]);
      });

      it("ranks an official template above a community one that matches as well, and below a curated one", async () => {
        const community = createCard({ title: "Static web" });
        const promoted = createCard({ title: "Web static", isOfficial: true });
        const { service } = setup({ isMarketplaceOn: true, cards: [community, promoted] });

        const { templates } = await service.listTemplates({ query: "static", includeCommunity: true });

        expect(templates.map(({ id }) => id)).toEqual(["nginx", promoted.id, community.id]);
      });

      it("finds a community template by its category, trims its summary and files one without a category under Community", async () => {
        const community = createCard({ title: "Rooms", summary: "x".repeat(300), categories: [] });
        const categorized = createCard({ title: "Lobby", summary: null, categories: ["Multiplayer"], resources: null });
        const { service } = setup({ isMarketplaceOn: true, cards: [community, categorized] });

        const all = await service.listTemplates({ includeCommunity: true });
        const byCategory = await service.listTemplates({ query: "multiplayer", includeCommunity: true });

        expect(all.templates.find(({ id }) => id === community.id)).toMatchObject({ category: "Community", summary: "x".repeat(200) });
        expect(byCategory.templates).toMatchObject([{ id: categorized.id, category: "Multiplayer", summary: "", gpu: null }]);
      });

      it("finds a community template by a word of its title, of any of its categories or of its summary", async () => {
        const community = createCard({ title: "Rooms", summary: "Realtime lobbies", categories: ["Games", "Multiplayer"] });
        const { service } = setup({ isMarketplaceOn: true, cards: [community, createCard({ title: "Unrelated", summary: null, categories: [] })] });

        const found = await Promise.all(
          ["rooms", "games", "multiplayer", "lobbies", "gamesmultiplayer", "null"].map(query => service.listTemplates({ query, includeCommunity: true }))
        );

        expect(found.map(({ templates }) => templates.map(({ id }) => id))).toEqual([[community.id], [community.id], [community.id], [community.id], [], []]);
      });

      it("lists ten templates at most", async () => {
        const cards = Array.from({ length: 12 }, (_, index) => createCard({ title: `Rooms ${index}` }));
        const { service } = setup({ isMarketplaceOn: true, cards });

        const { templates } = await service.listTemplates({ query: "rooms", includeCommunity: true });

        expect(templates.map(({ id }) => id)).toEqual(cards.slice(0, 10).map(({ id }) => id));
      });

      it("reads the marketplace again once its gallery is rebuilt", async () => {
        const { service, communityTemplateService } = setup({ isMarketplaceOn: true, cards: [createCard({ title: "Rooms" })] });
        const first = await service.listTemplates({ query: "rooms", includeCommunity: true });

        expect(await service.listTemplates({ query: "rooms", includeCommunity: true })).toEqual(first);
        communityTemplateService.getGallery.mockResolvedValue({ templates: [], officialUsage: {}, trendingRowMinTemplates: 4 });
        expect(await service.listTemplates({ query: "rooms", includeCommunity: true })).toEqual({ templates: [] });
      });
    });
  });

  describe("templateSdl", () => {
    it("reads Console's own templates without the gallery", async () => {
      const { service, templateController } = setup();

      const sdl = await service.templateSdl("hello-world");

      expect(sdl).toContain("image: ghcr.io/akash-network/hello-akash-world:2.1.0");
      expect(sdl).not.toContain("attributes");
      expect(templateController.getTemplateById).not.toHaveBeenCalled();
    });

    it("reads a gallery template's SDL", async () => {
      const { service, templateController } = setup();
      templateController.getTemplateById.mockResolvedValue({ data: mock<Template>({ deploy: "gallery sdl" }) });

      expect(await service.templateSdl("akash-network-awesome-akash-dart")).toBe("gallery sdl");
      expect(templateController.getTemplateById).toHaveBeenCalledWith("akash-network-awesome-akash-dart");
    });

    it("tells the model how to recover from a template id that does not exist", async () => {
      const { service, templateController } = setup();
      templateController.getTemplateById.mockRejectedValue(createError(404, "Template not found"));

      await expect(service.templateSdl("nginx")).rejects.toMatchObject({
        name: "AssistantToolError",
        message: "No template has this id. Call list_templates or pass an sdl.",
        untrustedDetail: '"nginx"'
      });
    });

    it("lets other failures to read a template through", async () => {
      const { service, templateController } = setup();
      const error = createError(503, "Gallery unavailable");
      templateController.getTemplateById.mockRejectedValue(error);

      await expect(service.templateSdl("nginx")).rejects.toBe(error);
    });

    it("never hands over the SDL of a marketplace template, and says how to open it in Configure instead", async () => {
      const community = createCard();
      const { service, templateController } = setup({ isMarketplaceOn: true, cards: [community] });

      await expect(service.templateSdl(community.id)).rejects.toMatchObject({
        name: "AssistantToolError",
        message:
          "A template whose id is a UUID is never deployed or screened from here: it only opens in Configure, where the user reviews it. Call propose_open_in_editor with this templateId and no sdl.",
        untrustedDetail: JSON.stringify(community.id)
      });
      await expect(service.templateSdl(community.id.toUpperCase())).rejects.toMatchObject({ name: "AssistantToolError" });
      expect(templateController.getTemplateById).not.toHaveBeenCalled();
    });

    it("still reads gallery templates with the template marketplace on", async () => {
      const { service, templateController } = setup({ isMarketplaceOn: true });
      templateController.getTemplateById.mockResolvedValue({ data: mock<Template>({ deploy: "gallery sdl" }) });

      expect(await service.templateSdl("akash-network-awesome-akash-dart")).toBe("gallery sdl");
      expect(await service.templateSdl("hello-world")).toContain("hello-akash-world");
    });

    it("looks a UUID up in the gallery like any id while the template marketplace is off", async () => {
      const { service, templateController } = setup();
      templateController.getTemplateById.mockRejectedValue(createError(404, "Template not found"));

      await expect(service.templateSdl(MARKETPLACE_ID)).rejects.toMatchObject({ message: "No template has this id. Call list_templates or pass an sdl." });
      expect(templateController.getTemplateById).toHaveBeenCalledWith(MARKETPLACE_ID);
    });
  });

  describe("refuseMarketplaceTemplate", () => {
    it("refuses a marketplace template's id in any letter case, and says how to open it in Configure instead", () => {
      const { service } = setup({ isMarketplaceOn: true });

      expect(() => service.refuseMarketplaceTemplate(MARKETPLACE_ID)).toThrow(
        expect.objectContaining({
          name: "AssistantToolError",
          message: expect.stringContaining("Call propose_open_in_editor with this templateId and no sdl."),
          untrustedDetail: JSON.stringify(MARKETPLACE_ID)
        })
      );
      expect(() => service.refuseMarketplaceTemplate(MARKETPLACE_ID.toUpperCase())).toThrow(expect.objectContaining({ name: "AssistantToolError" }));
    });

    it("lets a gallery or Console id through", () => {
      const { service } = setup({ isMarketplaceOn: true });

      expect(() => service.refuseMarketplaceTemplate("hello-world")).not.toThrow();
      expect(() => service.refuseMarketplaceTemplate(`${MARKETPLACE_ID}-copy`)).not.toThrow();
    });

    it("lets a UUID through while the template marketplace is off", () => {
      const { service } = setup();

      expect(() => service.refuseMarketplaceTemplate(MARKETPLACE_ID)).not.toThrow();
    });
  });

  describe("templateReview", () => {
    it("says nothing about a template while the template marketplace is off", async () => {
      const { service, communityTemplateService } = setup({ cards: [createCard({ id: MARKETPLACE_ID })] });

      expect(await service.templateReview(MARKETPLACE_ID)).toBeUndefined();
      expect(await service.templateReview("nginx")).toBeUndefined();
      expect(communityTemplateService.getGallery).not.toHaveBeenCalled();
    });

    it("reads a template the gallery lists as reviewed by Akash", async () => {
      const { service, communityTemplateService } = setup({ isMarketplaceOn: true });

      expect(await service.templateReview("akash-network-awesome-akash-dart")).toEqual({ source: "awesome_akash", reviewedByAkash: true });
      expect(await service.templateReview("comfyui")).toEqual({ source: "awesome_akash", reviewedByAkash: true });
      expect(communityTemplateService.getGallery).not.toHaveBeenCalled();
    });

    it("reads Console's own template as reviewed by Akash without the gallery", async () => {
      const { service, templateController } = setup({ isMarketplaceOn: true });

      expect(await service.templateReview("hello-world")).toEqual({ source: "awesome_akash", reviewedByAkash: true });
      expect(templateController.getTemplatesListJson).not.toHaveBeenCalled();
    });

    it.each(["made-up-template", `${MARKETPLACE_ID}-copy`, `my-${MARKETPLACE_ID}`, "NGINX"])(
      "refuses %s, which neither Console nor the gallery lists",
      async id => {
        const { service } = setup({ isMarketplaceOn: true, cards: [createCard({ id: MARKETPLACE_ID })] });

        await expect(service.templateReview(id)).rejects.toMatchObject({
          name: "AssistantToolError",
          message: "No listed template has this id. Call list_templates.",
          untrustedDetail: JSON.stringify(id)
        });
      }
    );

    it("reads a listed community template as not reviewed, and one Akash promoted as reviewed", async () => {
      const community = createCard();
      const promoted = createCard({ isOfficial: true });
      const { service } = setup({ isMarketplaceOn: true, cards: [community, promoted] });

      expect(await service.templateReview(community.id)).toEqual({ source: "console", reviewedByAkash: false });
      expect(await service.templateReview(community.id.toUpperCase())).toEqual({ source: "console", reviewedByAkash: false });
      expect(await service.templateReview(promoted.id)).toEqual({ source: "console", reviewedByAkash: true });
    });

    it("refuses a marketplace id the gallery does not list, which nothing vouches for", async () => {
      const { service } = setup({ isMarketplaceOn: true, cards: [createCard()] });

      await expect(service.templateReview(MARKETPLACE_ID)).rejects.toMatchObject({
        name: "AssistantToolError",
        message: "No listed template has this id. Call list_templates.",
        untrustedDetail: JSON.stringify(MARKETPLACE_ID)
      });
    });
  });

  function createCard(overrides: Partial<CommunityTemplateCard> = {}): CommunityTemplateCard {
    return {
      id: faker.string.uuid(),
      title: "Web starter",
      summary: "Runs a small web service",
      icon: null,
      categories: ["Web"],
      isOfficial: false,
      isFeatured: false,
      versionCount: 1,
      publishedAt: new Date("2026-11-01T00:00:00.000Z"),
      updatedAt: new Date("2026-11-02T00:00:00.000Z"),
      publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false },
      resources: { cpu: 1, memoryBytes: 1, storageBytes: 1 },
      usage: { deploys: 0, stillUpAfter24h: null, forks: 0 },
      scores: { popular: null, trending: null, isTrending: false },
      ...overrides
    };
  }

  function setup(input: { isMarketplaceOn?: boolean; cards?: CommunityTemplateCard[] } = {}) {
    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: "user-1" }) });
    const walletController = mock<WalletController>();
    const walletSettingController = mock<WalletSettingController>();
    const deploymentController = mock<DeploymentController>();
    const templateController = mock<TemplateController>();
    const gallery = Buffer.from(JSON.stringify(GALLERY));
    templateController.getTemplatesListJson.mockResolvedValue(gallery);
    const usdService = new AssistantUsdService(mock<DenomExchangeService>());
    const communityTemplateService = mock<CommunityTemplateService>();
    communityTemplateService.getGallery.mockResolvedValue({ templates: input.cards ?? [], officialUsage: {}, trendingRowMinTemplates: 4 });
    const featureFlags = mock<FeatureFlagsService>();
    featureFlags.isEnabled.mockImplementation(flag => flag === FeatureFlags.TEMPLATE_MARKETPLACE && input.isMarketplaceOn === true);
    const service = new AssistantAccountToolsService(
      authService,
      walletController,
      walletSettingController,
      deploymentController,
      templateController,
      usdService,
      communityTemplateService,
      featureFlags
    );

    return { service, walletController, walletSettingController, deploymentController, templateController, communityTemplateService };
  }
});
