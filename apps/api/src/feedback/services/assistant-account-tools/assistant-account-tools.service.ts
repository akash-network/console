import { isHttpError } from "http-errors";
import { singleton } from "tsyringe";
import { z } from "zod";

import { AuthService } from "@src/auth/services/auth.service";
import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletSettingController } from "@src/billing/controllers/wallet-settings/wallet-settings.controller";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { tokenize } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import type { ReadToolArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { TemplateController } from "@src/template/controllers/template/template.controller";

const LISTED_TEMPLATES_LIMIT = 10;
const MAX_TEMPLATE_SUMMARY_LENGTH = 200;

const TemplateGallerySchema = z.object({
  data: z.array(
    z.object({
      title: z.string(),
      templates: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          summary: z.string().nullish(),
          hardware: z
            .object({ gpu: z.object({ units: z.number(), models: z.array(z.string()) }).optional() })
            .passthrough()
            .optional()
        })
      )
    })
  )
});

interface ListedTemplate {
  id: string;
  name: string;
  category: string;
  summary: string;
  gpu: { units: number; models: string[] } | null;
  terms: Set<string>;
}

async function settledOrNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isHttpError(error) && error.status < 500) return null;
    throw error;
  }
}

@singleton()
export class AssistantAccountToolsService {
  #gallery: { source: Buffer; templates: ListedTemplate[] } | undefined;

  constructor(
    private readonly authService: AuthService,
    private readonly walletController: WalletController,
    private readonly walletSettingController: WalletSettingController,
    private readonly deploymentController: DeploymentController,
    private readonly templateController: TemplateController
  ) {}

  async getBalanceAndSpend(_: ReadToolArguments<"get_balance_and_spend">) {
    const [wallets, walletSettings, spendRate, weeklyCost] = await Promise.all([
      settledOrNull(this.walletController.getWallets({ userId: this.authService.currentUser.id })),
      settledOrNull(this.walletSettingController.getWalletSettings()),
      settledOrNull(this.deploymentController.getSpendRate()),
      settledOrNull(this.deploymentController.getWeeklyDeploymentCost())
    ]);
    const wallet = wallets?.data[0];

    return {
      creditBalanceUsd: wallet?.creditAmount ?? null,
      isTrialing: wallet?.isTrialing ?? null,
      trialEndsAt: wallet?.trialEndsAt ?? null,
      weeklyCostUsd: weeklyCost?.data.weeklyCost ?? null,
      spendPerBlockByDeployment: spendRate?.data.deployments ?? null,
      autoRecharge: walletSettings
        ? {
            enabled: walletSettings.data.autoReloadEnabled,
            thresholdUsd: walletSettings.data.autoReloadThreshold,
            amountUsd: walletSettings.data.autoReloadAmount
          }
        : { enabled: false }
    };
  }

  async listTemplates({ query }: ReadToolArguments<"list_templates">) {
    const templates = await this.#templates();
    const terms = tokenize(query ?? "");
    const matches = terms.length
      ? templates
          .map(template => ({ template, hits: terms.filter(term => template.terms.has(term)).length }))
          .filter(({ hits }) => hits > 0)
          .sort((left, right) => right.hits - left.hits)
          .map(({ template }) => template)
      : templates;

    return {
      templates: matches.slice(0, LISTED_TEMPLATES_LIMIT).map(({ id, name, category, summary, gpu }) => ({ id, name, category, summary, gpu }))
    };
  }

  /** Parsed once per gallery build, since the gallery is large and only changes when its cache is rebuilt. */
  async #templates(): Promise<ListedTemplate[]> {
    const source = await this.templateController.getTemplatesListJson();
    if (this.#gallery?.source === source) return this.#gallery.templates;

    const { data } = TemplateGallerySchema.parse(JSON.parse(source.toString("utf8")));
    const templates = data.flatMap(({ title, templates }) =>
      templates.map(({ id, name, summary, hardware }) => ({
        id,
        name,
        category: title,
        summary: (summary ?? "").slice(0, MAX_TEMPLATE_SUMMARY_LENGTH),
        gpu: hardware?.gpu ?? null,
        terms: new Set(tokenize(`${id} ${name} ${title} ${summary ?? ""}`))
      }))
    );
    this.#gallery = { source, templates };

    return templates;
  }
}
