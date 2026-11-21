import type { TemplateHardware } from "@akashnetwork/http-sdk";

import { AWESOME_AKASH_PUBLISHER } from "@src/components/templates/communityGallery/GalleryEntryCard/GalleryEntryCard";
import { pluralize } from "@src/components/templates/communityGallery/usageNumbers";
import { usePublicTemplate } from "@src/queries/useTemplateQuery";
import { useMarketplaceTemplate } from "@src/queries/useUserTemplateQueries";
import { isClientError } from "@src/services/query-error-policy/query-error-policy";
import type { AssistantActionOf } from "@src/types/assistant";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useMarketplaceTemplate, usePublicTemplate };

export type SuggestedTemplateSource = NonNullable<AssistantActionOf<"open_in_editor">["template"]>["source"];

export interface ReadableSuggestedTemplate {
  status: "ready";
  title: string;
  summary: string | null;
  icon: string | null;
  publisher: { name: string; verified: boolean } | null;
  facts: string[];
  hardware: TemplateHardware | null;
  /** False for a template Akash staff have not promoted, whatever the assistant said about it. */
  isOfficial: boolean;
  viewUrl: string | null;
  configureUrl: string;
}

export type SuggestedTemplate = { status: "loading" } | { status: "unavailable" } | { status: "failed"; retry: () => void } | ReadableSuggestedTemplate;

const AWESOME_AKASH_FACT = "awesome-akash";
const BUILT_IN_FACT = "Built into Console";

/** Reads what a suggested template is called and who published it by its id, so nothing the model wrote is shown as the template's own words. */
export function useSuggestedTemplate(source: SuggestedTemplateSource, templateId: string, d: typeof DEPENDENCIES = DEPENDENCIES): SuggestedTemplate {
  const builtInTemplate = source === "awesome_akash" ? hardcodedTemplates.find(template => template.code === templateId) : undefined;
  const consoleQuery = d.useMarketplaceTemplate(source === "console" ? templateId : undefined);
  const awesomeAkashQuery = d.usePublicTemplate(source === "awesome_akash" && !builtInTemplate ? templateId : undefined);

  if (builtInTemplate) {
    return {
      status: "ready",
      title: builtInTemplate.title,
      summary: builtInTemplate.description,
      icon: null,
      publisher: AWESOME_AKASH_PUBLISHER,
      facts: [BUILT_IN_FACT],
      hardware: null,
      isOfficial: true,
      viewUrl: null,
      configureUrl: UrlService.configureDeployment({ templateId })
    };
  }

  const query = source === "console" ? consoleQuery : awesomeAkashQuery;
  if (query.isLoading) return { status: "loading" };
  if (isClientError(query.error)) return { status: "unavailable" };

  if (source === "console" && consoleQuery.data) {
    const template = consoleQuery.data;
    const version = template.currentVersion;
    if (!version) return { status: "unavailable" };

    return {
      status: "ready",
      title: template.title,
      summary: template.summary,
      icon: template.icon,
      publisher: template.publisher && { name: template.publisher.name, verified: template.publisher.verified },
      facts: [`v${version.version}`, pluralize(template.usage.deploys, "deploy")],
      hardware: version.resources,
      isOfficial: template.isOfficial,
      viewUrl: UrlService.template(template.id),
      configureUrl: UrlService.configureDeployment({ userTemplateId: template.id })
    };
  }

  if (source === "awesome_akash" && awesomeAkashQuery.data) {
    const template = awesomeAkashQuery.data;

    return {
      status: "ready",
      title: template.name,
      summary: template.summary || null,
      icon: null,
      publisher: AWESOME_AKASH_PUBLISHER,
      facts: [AWESOME_AKASH_FACT],
      hardware: null,
      isOfficial: true,
      viewUrl: UrlService.templateDetails(templateId),
      configureUrl: UrlService.configureDeployment({ templateId })
    };
  }

  return query.isError ? { status: "failed", retry: () => void query.refetch() } : { status: "unavailable" };
}
