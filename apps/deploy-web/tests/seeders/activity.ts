import { faker } from "@faker-js/faker";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";

export const buildActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: faker.string.uuid(),
  type: "deployment_close",
  status: "pending",
  meta: { dseq: faker.string.numeric(7) },
  seenAt: null,
  createdAt: faker.date.recent().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  ...overrides
});
