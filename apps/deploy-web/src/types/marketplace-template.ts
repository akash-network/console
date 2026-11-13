import type { components } from "@akashnetwork/console-api-types";

export type UserTemplateListItem = components["schemas"]["UserTemplateListItem"];

export type TemplateVisibility = UserTemplateListItem["visibility"];

export type TemplateIconId = NonNullable<components["schemas"]["CreateUserTemplateRequest"]["data"]["icon"]>;

export type TemplateVersionDetail = NonNullable<components["schemas"]["MarketplaceTemplate"]["currentVersion"]>;

export type MarketplaceTemplate = components["schemas"]["MarketplaceTemplate"];

export type TemplateSource = { template: MarketplaceTemplate; version: TemplateVersionDetail };

export type TemplateVersionSummary = components["schemas"]["TemplateVersionSummary"];

export type TemplateAskedValue = components["schemas"]["TemplateAskedValue"];

export type TemplateCategory = NonNullable<components["schemas"]["UpdateUserTemplateRequest"]["data"]["categories"]>[number];
