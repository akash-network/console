import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import type { WalletSettingController } from "@src/billing/controllers/wallet-settings/wallet-settings.controller";
import type { WalletSettingsResponse } from "@src/billing/http-schemas/wallet.schema";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { TemplateController } from "@src/template/controllers/template/template.controller";
import type { Template } from "@src/template/types/template";
import type { UserOutput } from "@src/user/repositories";
import { AssistantAccountToolsService } from "./assistant-account-tools.service";

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
            creditAmount: 12.5,
            address: "akash1",
            denom: "uact",
            isTrialing: true,
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
      deploymentController.getSpendRate.mockResolvedValue({ data: { deployments: [{ dseq: "42", price: { denom: "uact", amount: "10" } }] } });
      deploymentController.getWeeklyDeploymentCost.mockResolvedValue({ data: { weeklyCost: 3.5 } });

      const result = await service.getBalanceAndSpend({});

      expect(walletController.getWallets).toHaveBeenCalledWith({ userId: "user-1" });
      expect(result).toEqual({
        creditBalanceUsd: 12.5,
        isTrialing: true,
        trialEndsAt: new Date("2026-12-01T00:00:00.000Z"),
        weeklyCostUsd: 3.5,
        spendPerBlockByDeployment: [{ dseq: "42", price: { denom: "uact", amount: "10" } }],
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
        spendPerBlockByDeployment: null,
        autoRecharge: { enabled: false }
      });
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

      await expect(service.templateSdl("nginx")).rejects.toThrow(new AssistantToolError('No template has id "nginx". Call list_templates or pass an sdl.'));
    });

    it("lets other failures to read a template through", async () => {
      const { service, templateController } = setup();
      const error = createError(503, "Gallery unavailable");
      templateController.getTemplateById.mockRejectedValue(error);

      await expect(service.templateSdl("nginx")).rejects.toBe(error);
    });
  });

  function setup() {
    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: "user-1" }) });
    const walletController = mock<WalletController>();
    const walletSettingController = mock<WalletSettingController>();
    const deploymentController = mock<DeploymentController>();
    const templateController = mock<TemplateController>();
    const gallery = Buffer.from(JSON.stringify(GALLERY));
    templateController.getTemplatesListJson.mockResolvedValue(gallery);
    const service = new AssistantAccountToolsService(authService, walletController, walletSettingController, deploymentController, templateController);

    return { service, walletController, walletSettingController, deploymentController, templateController };
  }
});
