import { faker } from "@faker-js/faker";

import type { UserTemplateListItem } from "@src/types/marketplace-template";

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
