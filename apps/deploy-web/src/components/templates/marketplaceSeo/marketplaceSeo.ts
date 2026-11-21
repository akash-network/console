import type { NextSeoProps } from "next-seo";

import { isListedInGallery } from "@src/services/marketplace-preview-image/preview-image-content";
import type { MarketplaceTemplate, TemplatePublisherPage } from "@src/types/marketplace-template";
import { domainName, UrlService } from "@src/utils/urlUtils";

const PREVIEW_IMAGE_WIDTH = 1200;
const PREVIEW_IMAGE_HEIGHT = 630;
const MAX_DESCRIPTION_LENGTH = 200;

const TEMPLATE_WITHOUT_SUMMARY_DESCRIPTION = "A template you can deploy on Akash Network from Akash Console.";

type TemplateSeoFields = Pick<MarketplaceTemplate, "id" | "title" | "summary" | "visibility" | "isListed" | "publishedAt" | "moderationStatus" | "canEdit">;
type PublisherSeoFields = Pick<TemplatePublisherPage, "handle" | "name" | "bio" | "counts">;

/**
 * The head tags of a template page. Its address is the same whatever tab, campaign or search brought the visitor there,
 * and only a template the gallery lists, seen as a visitor sees it, may be indexed or pictured.
 */
export function buildTemplateSeo(template: TemplateSeoFields): NextSeoProps {
  const isListed = isListedInGallery(template);

  return buildSeo({
    title: template.title,
    description: toDescription(template.summary) || TEMPLATE_WITHOUT_SUMMARY_DESCRIPTION,
    path: UrlService.template(template.id),
    noindex: !isListed || template.canEdit,
    image: isListed ? { path: UrlService.templatePreviewImage(template.id), alt: `${template.title} on Akash Console` } : undefined
  });
}

export function buildPublisherSeo(publisher: PublisherSeoFields, view: { isOwnProfile: boolean }): NextSeoProps {
  return buildSeo({
    title: `${publisher.name} · Templates`,
    description: toDescription(publisher.bio) || `Templates published by ${publisher.name} on Akash Console.`,
    path: UrlService.templatePublisher(publisher.handle),
    noindex: publisher.counts.templates === 0 || view.isOwnProfile,
    image: { path: UrlService.templatePublisherPreviewImage(publisher.handle), alt: `${publisher.name} on Akash Console` }
  });
}

interface SeoInput {
  title: string;
  description: string;
  path: string;
  noindex: boolean;
  image: { path: string; alt: string } | undefined;
}

function buildSeo({ title, description, path, noindex, image }: SeoInput): NextSeoProps {
  const url = `${domainName}${path}`;
  const images = image && [{ url: `${domainName}${image.path}`, width: PREVIEW_IMAGE_WIDTH, height: PREVIEW_IMAGE_HEIGHT, alt: image.alt, type: "image/png" }];

  return {
    title,
    description,
    canonical: url,
    noindex,
    openGraph: { type: "website", url, title, description, images },
    twitter: { cardType: "summary_large_image" },
    additionalMetaTags: [
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(images ? [{ name: "twitter:image", content: images[0].url }] : [])
    ]
  };
}

function toDescription(text: string | null): string {
  const singleSpaced = (text ?? "").replace(/\s+/g, " ").trim();
  if (singleSpaced.length <= MAX_DESCRIPTION_LENGTH) return singleSpaced;

  return `${singleSpaced.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
}
