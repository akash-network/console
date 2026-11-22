import type { Types } from "@amplitude/analytics-browser";

export const TEMPLATE_PAGE_TITLE_SUFFIX = " · Template";
export const PUBLISHER_PAGE_TITLE_SUFFIX = " · Templates";
export const AWESOME_AKASH_TEMPLATE_TITLE_PREFIX = "Template detail ";

const SITE_TITLE_SUFFIX = " | Akash Console";
const PAGE_TITLE_PROPERTY = "[Amplitude] Page Title";

/** Amplitude gives these no page properties, and one added here would change what they are. */
const EVENTS_WITHOUT_PAGE_PROPERTIES = new Set(["$identify", "$groupidentify", "revenue_amount"]);

const USER_WRITTEN_TITLES: { isUserWritten: (title: string) => boolean; trackedTitle: string }[] = [
  { isUserWritten: title => title.endsWith(`${TEMPLATE_PAGE_TITLE_SUFFIX}${SITE_TITLE_SUFFIX}`), trackedTitle: `Template${SITE_TITLE_SUFFIX}` },
  { isUserWritten: title => title.endsWith(`${PUBLISHER_PAGE_TITLE_SUFFIX}${SITE_TITLE_SUFFIX}`), trackedTitle: `Template publisher${SITE_TITLE_SUFFIX}` },
  {
    isUserWritten: title => title.startsWith(AWESOME_AKASH_TEMPLATE_TITLE_PREFIX) && title.endsWith(SITE_TITLE_SUFFIX),
    trackedTitle: `Template detail${SITE_TITLE_SUFFIX}`
  }
];

/** The title of a template or publisher page holds what its author wrote, so analytics gets the kind of page instead. */
export function toTrackedPageTitle(title: string): string {
  return USER_WRITTEN_TITLES.find(({ isUserWritten }) => isUserWritten(title))?.trackedTitle ?? title;
}

/**
 * Amplitude stamps the document title on its page views and, through its page enrichment, on every other event.
 * This runs before that enrichment, which keeps a title already set, and a client navigation's page view still carries the title of the page being left,
 * so the title is recognised by its wording rather than by the address.
 */
export function createMarketplacePageTitlePlugin(getDocumentTitle: () => string = () => document.title): Types.EnrichmentPlugin {
  return {
    name: "marketplace-page-title",
    type: "enrichment",
    execute: async event => {
      if (EVENTS_WITHOUT_PAGE_PROPERTIES.has(event.event_type)) return event;

      const properties: Record<string, unknown> = { ...event.event_properties };
      const sentTitle = properties[PAGE_TITLE_PROPERTY];
      const title = typeof sentTitle === "string" ? sentTitle : getDocumentTitle();
      const trackedTitle = toTrackedPageTitle(title);
      if (trackedTitle !== title) event.event_properties = { ...properties, [PAGE_TITLE_PROPERTY]: trackedTitle };

      return event;
    }
  };
}
