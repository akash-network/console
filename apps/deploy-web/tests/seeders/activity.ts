import { faker } from "@faker-js/faker";

import type { Activity, ActivityOfAnyType } from "@src/queries/useLatestActivitiesQuery";

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

export const buildActivityOfUnknownType = (overrides: Partial<ActivityOfAnyType> = {}): ActivityOfAnyType => ({
  ...buildActivity(),
  type: "a_newer_action",
  ...overrides
});
