import { faker } from "@faker-js/faker";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import type { CommunityTemplateCard } from "@src/types/marketplace-template";

export const buildCommunityTemplateCard = (overrides: Partial<CommunityTemplateCard> = {}): CommunityTemplateCard => {
  const publishedAt = overrides.publishedAt ?? faker.date.past().toISOString();

  return {
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    summary: null,
    icon: null,
    categories: [],
    isOfficial: false,
    isFeatured: false,
    importedRef: null,
    publisher: { name: faker.company.name(), handle: faker.internet.domainWord(), verified: false },
    resources: null,
    versionCount: 1,
    publishedAt,
    updatedAt: publishedAt,
    usage: { deploys: 0, stillUpAfter24h: null, forks: 0 },
    scores: { popular: null, trending: null, isTrending: false },
    ...overrides
  };
};

export const buildGalleryEntry = (overrides: Partial<GalleryEntry> = {}): GalleryEntry => {
  const id = overrides.id ?? faker.string.uuid();
  const title = overrides.title ?? faker.commerce.productName();

  return {
    key: `console:${id}`,
    origin: "console",
    id,
    title,
    summary: null,
    icon: null,
    categories: [],
    isOfficial: false,
    isFeatured: false,
    publisher: { name: faker.company.name(), handle: faker.internet.domainWord(), verified: false },
    resources: null,
    versionCount: 1,
    publishedAt: faker.date.past().getTime(),
    usage: { deploys: 0, stillUpAfter24h: null, forks: 0 },
    scores: { popular: null, trending: null, isTrending: false },
    curatedRank: 2,
    searchText: title.toLowerCase(),
    ...overrides
  };
};
