import { faker } from "@faker-js/faker";

import type { ProjectOutput } from "@src/types/project";

export const buildProject = (overrides: Partial<ProjectOutput> = {}): ProjectOutput => {
  const name = overrides.name ?? faker.word.noun();

  return {
    id: faker.string.uuid(),
    name,
    slug: name.toLowerCase(),
    description: null,
    isDefault: false,
    createdAt: faker.date.past().toISOString(),
    createdBy: { id: faker.string.uuid(), username: faker.internet.username() },
    ...overrides
  };
};
