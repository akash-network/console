import type { MarketplaceTemplate } from "@src/types/marketplace-template";

export type TemplateEventSource = "official" | "community" | "private";

/** What a template event says about its template: never a title, a summary, a README, an SDL, a value or a publisher. */
export interface TemplateEventSubject {
  source: TemplateEventSource;
  templateId: string;
  templateVersion: number | null;
}

/** An awesome-akash id is free text, so only one shaped like an id is sent, as the API does for its own template events. */
const SENDABLE_AWESOME_AKASH_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

export function describeConsoleTemplate(
  template: Pick<MarketplaceTemplate, "id" | "isOfficial" | "visibility">,
  templateVersion: number | null | undefined
): TemplateEventSubject {
  return { source: sourceOf(template), templateId: template.id, templateVersion: templateVersion ?? null };
}

export function describeAwesomeAkashTemplate(templateId: string | undefined): TemplateEventSubject | undefined {
  if (!templateId || !SENDABLE_AWESOME_AKASH_ID.test(templateId)) return undefined;

  return { source: "official", templateId, templateVersion: null };
}

function sourceOf(template: Pick<MarketplaceTemplate, "isOfficial" | "visibility">): TemplateEventSource {
  if (template.isOfficial) return "official";
  return template.visibility === "public" ? "community" : "private";
}
