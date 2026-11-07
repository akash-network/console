import { faker } from "@faker-js/faker";

import type { MarketplaceTemplate, TemplateVersionDetail, TemplateVersionSummary, UserTemplateListItem } from "@src/types/marketplace-template";

export const buildUserTemplateListItem = (overrides: Partial<UserTemplateListItem> = {}): UserTemplateListItem => {
  const updatedAt = overrides.updatedAt ?? faker.date.past().toISOString();

  return {
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    summary: null,
    icon: null,
    categories: [],
    visibility: "private",
    isListed: false,
    moderationStatus: "active",
    projectId: null,
    copiedFromId: null,
    updatedAt,
    currentVersion: { version: 1, status: "live", createdAt: updatedAt },
    lastEditedBy: { username: faker.internet.username() },
    canEdit: true,
    usage: { deploys: 0, lastDeployedAt: null },
    ...overrides
  };
};

export const buildTemplateVersionSummary = (overrides: Partial<TemplateVersionSummary> = {}): TemplateVersionSummary => ({
  id: faker.string.uuid(),
  templateId: faker.string.uuid(),
  version: 1,
  resources: null,
  status: "live",
  changes: ["first_version"],
  createdBy: { username: faker.internet.username() },
  createdAt: faker.date.past().toISOString(),
  deploys: 0,
  ...overrides
});

export const buildTemplateVersion = (overrides: Partial<TemplateVersionDetail> = {}): TemplateVersionDetail => {
  const { deploys: _deploys, ...fields } = buildTemplateVersionSummary();

  return {
    ...fields,
    sdl: 'version: "2.0"\nservices:\n  web:\n    image: nginx:1.27\n',
    readme: null,
    askedValues: [],
    ...overrides
  };
};

export const buildMarketplaceTemplate = (overrides: Partial<MarketplaceTemplate> = {}): MarketplaceTemplate => {
  const id = overrides.id ?? faker.string.uuid();
  const createdAt = faker.date.past().toISOString();

  return {
    id,
    title: faker.commerce.productName(),
    summary: null,
    icon: null,
    categories: [],
    visibility: "private",
    isListed: false,
    isOfficial: false,
    moderationStatus: "active",
    projectId: null,
    copiedFromId: null,
    createdAt,
    updatedAt: createdAt,
    author: { username: faker.internet.username() },
    publisher: { name: faker.company.name(), slug: null, type: "team" },
    currentVersion: buildTemplateVersion({ templateId: id }),
    canEdit: false,
    isFavorite: false,
    usage: { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null },
    ...overrides
  };
};
