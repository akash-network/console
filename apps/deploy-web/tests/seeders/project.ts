import { faker } from "@faker-js/faker";

import type { ProjectOutput } from "@src/types/project";

export const buildProject = (overrides: Partial<ProjectOutput> = {}): ProjectOutput => {
  const name = overrides.name ?? faker.word.noun();
  const createdAt = overrides.createdAt ?? faker.date.past().toISOString();

  return {
    id: faker.string.uuid(),
    name,
    slug: name.toLowerCase(),
    description: null,
    isDefault: false,
    createdAt,
    createdBy: { id: faker.string.uuid(), username: faker.internet.username() },
    lastActivityAt: createdAt,
    deployments: { activeCount: 0, preview: [] },
    access: { canDeploy: true, canManage: true },
    ...overrides
  };
};
