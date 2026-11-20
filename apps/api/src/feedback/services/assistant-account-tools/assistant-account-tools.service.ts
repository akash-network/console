import { isHttpError } from "http-errors";
import uniq from "lodash/uniq";
import { singleton } from "tsyringe";
import { z } from "zod";

import { AuthService } from "@src/auth/services/auth.service";
import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletSettingController } from "@src/billing/controllers/wallet-settings/wallet-settings.controller";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import type { DeploymentSpendRate } from "@src/deployment/http-schemas/deployment.schema";
import { tokenize } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { ReadToolArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { CONSOLE_TEMPLATES, consoleTemplateById } from "@src/feedback/lib/console-templates/console-templates";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";
import { TemplateController } from "@src/template/controllers/template/template.controller";
import type { TemplateSource as TemplateCatalog } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";
import {
  type CommunityGallery,
  type CommunityTemplateCard,
  CommunityTemplateService
} from "@src/template-marketplace/services/community-template/community-template.service";

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
          tags: z.array(z.string()).optional(),
          hardware: z
            .object({ gpu: z.object({ units: z.number(), models: z.array(z.string()) }).optional() })
            .passthrough()
            .optional()
        })
      )
    })
  )
});

type TemplateSource = "console" | "console_curated" | "official" | "community";

/** Worth up to one matched query word, so a Console template wins a close match but not one a community template matches clearly better. */
const SOURCE_BONUS: Record<TemplateSource, number> = { console: 1, console_curated: 0.5, official: 0.25, community: 0 };

const MARKETPLACE_TEMPLATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UNCATEGORIZED_MARKETPLACE_TEMPLATE = "Community";

const OPENS_IN_CONFIGURE_ONLY_MESSAGE =
  "A template whose id is a UUID is never deployed or screened from here: it only opens in Configure, where the user reviews it. Call propose_open_in_editor with this templateId and no sdl.";

const NOT_LISTED_MESSAGE = "No listed template has this id. Call list_templates.";

/** What the web labels a suggested template with: where its id resolves, and whether Akash reviewed what it deploys. */
export interface TemplateReview {
  source: TemplateCatalog;
  reviewedByAkash: boolean;
}

const CURATED_TAGS = new Set(["recommended", "popular"]);

interface ListedTemplate {
  id: string;
  name: string;
  category: string;
  source: TemplateSource;
  summary: string;
  gpu: { units: number; models: string[] } | null;
  terms: Set<string>;
  /** False only for a template another user published that Akash staff did not promote. */
  reviewedByAkash: boolean;
  publisher?: string;
}

type TemplateSearchResult = Pick<ListedTemplate, "id" | "name" | "category" | "source" | "summary" | "gpu"> &
  Partial<Pick<ListedTemplate, "reviewedByAkash" | "publisher">>;

/** With the marketplace on, an awesome-akash template nobody curated is an official one, and community means written by another user. */
function marketplaceSourceOf({ source, reviewedByAkash }: ListedTemplate): TemplateSource {
  return source === "community" && reviewedByAkash ? "official" : source;
}

function listedMarketplaceTemplateOf({ id, title, summary, categories, isOfficial, publisher, resources }: CommunityTemplateCard): ListedTemplate {
  return {
    id,
    name: title,
    category: categories[0] ?? UNCATEGORIZED_MARKETPLACE_TEMPLATE,
    source: isOfficial ? "official" : "community",
    summary: (summary ?? "").slice(0, MAX_TEMPLATE_SUMMARY_LENGTH),
    gpu: resources?.gpu ?? null,
    terms: new Set(tokenize(`${title} ${categories.join(" ")} ${summary ?? ""}`)),
    reviewedByAkash: isOfficial,
    publisher: publisher.name
  };
}

const BUILT_IN_TEMPLATES: ListedTemplate[] = CONSOLE_TEMPLATES.map(({ id, name, summary }) => ({
  id,
  name,
  category: "Console",
  source: "console",
  summary,
  gpu: null,
  terms: new Set(tokenize(`${id} ${name} ${summary}`)),
  reviewedByAkash: true
}));

function relevanceOf(template: ListedTemplate, terms: string[], source: TemplateSource): number {
  const hits = terms.filter(term => template.terms.has(term)).length;
  return hits > 0 ? hits + SOURCE_BONUS[source] : 0;
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
  #marketplace: { source: CommunityGallery; templates: ListedTemplate[] } | undefined;

  constructor(
    private readonly authService: AuthService,
    private readonly walletController: WalletController,
    private readonly walletSettingController: WalletSettingController,
    private readonly deploymentController: DeploymentController,
    private readonly templateController: TemplateController,
    private readonly usdService: AssistantUsdService,
    private readonly communityTemplateService: CommunityTemplateService,
    private readonly featureFlags: FeatureFlagsService
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
      creditBalanceUsd: wallet ? await this.usdService.usdOf([{ denom: wallet.denom, amount: wallet.creditAmount }]) : null,
      isTrialing: wallet?.isTrialing ?? null,
      trialEndsAt: wallet?.trialEndsAt ?? null,
      weeklyCostUsd: weeklyCost?.data.weeklyCost ?? null,
      spendByDeployment: spendRate ? await this.#spendByDeployment(spendRate.data.deployments) : null,
      autoRecharge: walletSettings
        ? {
            enabled: walletSettings.data.autoReloadEnabled,
            thresholdUsd: walletSettings.data.autoReloadThreshold,
            amountUsd: walletSettings.data.autoReloadAmount
          }
        : { enabled: false }
    };
  }

  /** The spend rate lists one entry per denom of a deployment, so each deployment's entries are summed into one monthly cost. */
  async #spendByDeployment(spendRates: DeploymentSpendRate[]) {
    const dseqs = uniq(spendRates.map(({ dseq }) => dseq));
    const names = await settledOrNull(this.deploymentController.findNames(dseqs));

    return await Promise.all(
      dseqs.map(async dseq => ({
        dseq,
        name: names?.data[dseq] ?? null,
        usdPerMonth: await this.usdService.usdPerMonthOf(spendRates.filter(spendRate => spendRate.dseq === dseq).map(({ price }) => price))
      }))
    );
  }

  /** Templates other users published join the search only with the marketplace on, and the unreviewed ones only when asked for. */
  async listTemplates({ query, includeCommunity }: ReadToolArguments<"list_templates">) {
    const isMarketplaceOn = this.#isMarketplaceOn();
    const marketplaceTemplates = isMarketplaceOn ? await this.#marketplaceTemplates() : [];
    const templates = [
      ...BUILT_IN_TEMPLATES,
      ...(await this.#galleryTemplates()),
      ...marketplaceTemplates.filter(({ reviewedByAkash }) => includeCommunity === true || reviewedByAkash)
    ];
    const sourceOf = (template: ListedTemplate) => (isMarketplaceOn ? marketplaceSourceOf(template) : template.source);
    const terms = tokenize(query ?? "");
    const matches = terms.length
      ? templates
          .map(template => ({ template, relevance: relevanceOf(template, terms, sourceOf(template)) }))
          .filter(({ relevance }) => relevance > 0)
          .sort((left, right) => right.relevance - left.relevance)
          .map(({ template }) => template)
      : templates;

    return {
      templates: matches.slice(0, LISTED_TEMPLATES_LIMIT).map((template): TemplateSearchResult => {
        const { id, name, category, source, summary, gpu, reviewedByAkash, publisher } = template;
        if (!isMarketplaceOn) return { id, name, category, source, summary, gpu };

        return { id, name, category, source: sourceOf(template), reviewedByAkash, summary, gpu, ...(publisher !== undefined && { publisher }) };
      })
    };
  }

  async templateSdl(id: string): Promise<string> {
    if (this.#isMarketplaceTemplateId(id)) throw new AssistantToolError(OPENS_IN_CONFIGURE_ONLY_MESSAGE, JSON.stringify(id));

    return consoleTemplateById(id)?.sdl ?? (await this.#galleryTemplateSdl(id));
  }

  /** Answers nothing with the marketplace off, and refuses a marketplace id the gallery does not list, which would otherwise pass for a reviewed template. */
  async templateReview(id: string): Promise<TemplateReview | undefined> {
    if (!this.#isMarketplaceOn()) return undefined;
    if (!MARKETPLACE_TEMPLATE_ID.test(id)) return { source: "awesome_akash", reviewedByAkash: true };

    const { templates } = await this.communityTemplateService.getGallery();
    const template = templates.find(card => card.id === id.toLowerCase());
    if (!template) throw new AssistantToolError(NOT_LISTED_MESSAGE, JSON.stringify(id));

    return { source: "console", reviewedByAkash: template.isOfficial };
  }

  #isMarketplaceOn(): boolean {
    return this.featureFlags.isEnabled(FeatureFlags.TEMPLATE_MARKETPLACE);
  }

  #isMarketplaceTemplateId(id: string): boolean {
    return MARKETPLACE_TEMPLATE_ID.test(id) && this.#isMarketplaceOn();
  }

  /** Mapped once per gallery reading, which the gallery itself keeps for a minute. */
  async #marketplaceTemplates(): Promise<ListedTemplate[]> {
    const source = await this.communityTemplateService.getGallery();
    if (this.#marketplace?.source !== source) this.#marketplace = { source, templates: source.templates.map(listedMarketplaceTemplateOf) };

    return this.#marketplace.templates;
  }

  async #galleryTemplateSdl(id: string): Promise<string> {
    try {
      return (await this.templateController.getTemplateById(id)).data.deploy;
    } catch (error) {
      if (isHttpError(error) && error.status === 404)
        throw new AssistantToolError("No template has this id. Call list_templates or pass an sdl.", JSON.stringify(id));
      throw error;
    }
  }

  /** Parsed once per gallery build, since the gallery is large and only changes when its cache is rebuilt. */
  async #galleryTemplates(): Promise<ListedTemplate[]> {
    const source = await this.templateController.getTemplatesListJson();
    if (this.#gallery?.source === source) return this.#gallery.templates;

    const { data } = TemplateGallerySchema.parse(JSON.parse(source.toString("utf8")));
    const templates = data.flatMap(({ title, templates }) =>
      templates.map(({ id, name, summary, tags, hardware }) => ({
        id,
        name,
        category: title,
        source: tags?.some(tag => CURATED_TAGS.has(tag)) ? ("console_curated" as const) : ("community" as const),
        summary: (summary ?? "").slice(0, MAX_TEMPLATE_SUMMARY_LENGTH),
        gpu: hardware?.gpu ?? null,
        terms: new Set(tokenize(`${id} ${name} ${title} ${summary ?? ""}`)),
        reviewedByAkash: true
      }))
    );
    this.#gallery = { source, templates };

    return templates;
  }
}
