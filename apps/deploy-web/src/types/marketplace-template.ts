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

export type TemplatePublishReadiness = components["schemas"]["TemplatePublishReadiness"];

export type TemplatePublishCheck = components["schemas"]["TemplatePublishCheck"];

export type TemplateCheckResults = NonNullable<TemplateVersionSummary["checkResults"]>;

export type TemplateVersionHoldReason = components["schemas"]["TemplateVersionHoldReason"];

export type TemplateReportReason = components["schemas"]["CreateTemplateReportRequest"]["data"]["reason"];

export type CommunityTemplateCard = components["schemas"]["CommunityTemplateCard"];

export type CommunityTemplateUsage = components["schemas"]["CommunityTemplateUsage"];

export type TemplateScores = components["schemas"]["TemplateScores"];

export type CommunityTemplateGallery = components["schemas"]["ListCommunityTemplatesResponse"]["data"];

export type TemplatePublisherPage = components["schemas"]["TemplatePublisherPage"];

export type TemplatePublisherLink = TemplatePublisherPage["links"][number];

export type CurrentTemplatePublisher = components["schemas"]["CurrentTemplatePublisher"];

export type TemplatePublisherProfileChange = components["schemas"]["UpdateCurrentTemplatePublisherRequest"]["data"];
