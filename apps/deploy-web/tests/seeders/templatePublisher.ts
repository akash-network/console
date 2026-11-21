import { faker } from "@faker-js/faker";

import type { TemplatePublisherPage } from "@src/types/marketplace-template";

export const buildTemplatePublisherPage = (overrides: Partial<TemplatePublisherPage> = {}): TemplatePublisherPage => {
  const templates = overrides.templates ?? [];

  return {
    name: faker.company.name(),
    handle: faker.internet.domainWord(),
    type: "team",
    bio: null,
    links: [],
    verified: false,
    memberSince: faker.date.past().toISOString(),
    counts: { templates: templates.length, deploys: 0 },
    templates,
    ...overrides
  };
};
