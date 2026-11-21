import { formatBytes } from "@src/components/deployments/ConfigureDeployment/DeploymentResourceSummary/deploymentResources";
import { formatCount, pluralize } from "@src/components/templates/communityGallery/usageNumbers";
import type { MarketplaceTemplate, TemplatePublisherPage } from "@src/types/marketplace-template";
import { initialsOf } from "@src/utils/initials";
import { roundDecimal } from "@src/utils/mathHelpers";
import { isRenderableCharacter, toRenderableText } from "./preview-image-text";

export interface TemplatePreviewContent {
  kind: "template";
  title: string;
  summary: string;
  trustLabel: string;
  publisher: { name: string; initials: string; isVerified: boolean } | null;
  hardware: string[];
}

export interface PublisherPreviewContent {
  kind: "publisher";
  name: string;
  initials: string;
  isVerified: boolean;
  bio: string;
  counts: string[];
}

export type PreviewImageContent = TemplatePreviewContent | PublisherPreviewContent;

export const OFFICIAL_TRUST_LABEL = "Official template";
export const COMMUNITY_TRUST_LABEL = "Community template · not reviewed by Akash";

const MAX_TITLE_LENGTH = 70;
const MAX_SUMMARY_LENGTH = 150;
const MAX_PUBLISHER_NAME_LENGTH = 40;
const MAX_BIO_LENGTH = 170;
const MAX_GPU_MODELS_LENGTH = 24;

const UNNAMED_TEMPLATE_TITLE = "Template on Akash Console";
const UNNAMED_PUBLISHER_NAME = "Community publisher";

type ListedTemplateFields = Pick<MarketplaceTemplate, "visibility" | "isListed" | "publishedAt" | "moderationStatus">;

/** The templates the gallery lists, which are the only ones a search engine may index or a preview image may describe. */
export function isListedInGallery(template: ListedTemplateFields): boolean {
  return template.visibility === "public" && template.isListed && template.publishedAt !== null && template.moderationStatus === "active";
}

export function toTemplatePreviewContent(template: MarketplaceTemplate): TemplatePreviewContent {
  return {
    kind: "template",
    title: toRenderableText(template.title, MAX_TITLE_LENGTH) || UNNAMED_TEMPLATE_TITLE,
    summary: toRenderableText(template.summary, MAX_SUMMARY_LENGTH),
    trustLabel: template.isOfficial ? OFFICIAL_TRUST_LABEL : COMMUNITY_TRUST_LABEL,
    publisher: template.publisher ? { ...describePublisher(template.publisher.name), isVerified: template.publisher.verified } : null,
    hardware: describeHardware(template.currentVersion?.resources ?? null)
  };
}

export function toPublisherPreviewContent(publisher: TemplatePublisherPage): PublisherPreviewContent {
  return {
    kind: "publisher",
    ...describePublisher(publisher.name),
    isVerified: publisher.verified,
    bio: toRenderableText(publisher.bio, MAX_BIO_LENGTH),
    counts: [pluralize(publisher.counts.templates, "template"), `${formatCount(publisher.counts.deploys)} total deploys`]
  };
}

function describePublisher(publisherName: string) {
  const name = toRenderableText(publisherName, MAX_PUBLISHER_NAME_LENGTH) || UNNAMED_PUBLISHER_NAME;
  return { name, initials: renderableInitialsOf(name) };
}

/** An initial is capitalized after the name was checked, and the capital of a character the shipped fonts cover is not always one they cover. */
function renderableInitialsOf(name: string): string {
  return [...initialsOf(name)].filter(isRenderableCharacter).join("") || initialsOf(UNNAMED_PUBLISHER_NAME);
}

type TemplateResources = NonNullable<MarketplaceTemplate["currentVersion"]>["resources"];

function describeHardware(resources: TemplateResources): string[] {
  if (!resources) return [];

  const gpu = resources.gpu ? [describeGpu(resources.gpu)] : [];
  return [...gpu, `${roundDecimal(resources.cpu, 2)} vCPU`, `${formatBytes(resources.memoryBytes)} memory`, `${formatBytes(resources.storageBytes)} storage`];
}

function describeGpu({ units, models }: NonNullable<NonNullable<TemplateResources>["gpu"]>): string {
  const accepted = toRenderableText(models.map(model => model.toUpperCase()).join(" / "), MAX_GPU_MODELS_LENGTH);
  return accepted ? `${units}× ${accepted}` : `${units}× GPU`;
}
