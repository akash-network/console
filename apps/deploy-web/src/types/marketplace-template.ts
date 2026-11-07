import type { components } from "@akashnetwork/console-api-types";

export type UserTemplateListItem = components["schemas"]["UserTemplateListItem"];

export type TemplateVisibility = UserTemplateListItem["visibility"];

export type TemplateIconId = NonNullable<components["schemas"]["CreateUserTemplateRequest"]["data"]["icon"]>;

export type TemplateVersionDetail = NonNullable<components["schemas"]["MarketplaceTemplate"]["currentVersion"]>;

/** The API answers a null current version for a template an older pod saved without one, which the generated type drops. */
export type MarketplaceTemplate = Omit<components["schemas"]["MarketplaceTemplate"], "currentVersion"> & { currentVersion: TemplateVersionDetail | null };

export type TemplateVersionSummary = components["schemas"]["TemplateVersionSummary"];

export type TemplateAskedValue = components["schemas"]["TemplateAskedValue"];

export type TemplateCategory = NonNullable<components["schemas"]["UpdateUserTemplateRequest"]["data"]["categories"]>[number];
