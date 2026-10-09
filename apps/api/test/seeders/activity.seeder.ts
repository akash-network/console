import { faker } from "@faker-js/faker";

import type { ActivityOutput } from "@src/activity/repositories/activity/activity.repository";

export function createActivity({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  type = "deployment_close",
  status = "succeeded",
  initiator = "user",
  meta = { dseq: faker.number.int({ min: 100000, max: 999999 }).toString() },
  dedupeKey = null,
  seenAt = null,
  createdAt = faker.date.recent().toISOString(),
  updatedAt = createdAt
}: Partial<ActivityOutput> = {}): ActivityOutput {
  return { id, userId, type, status, initiator, meta, dedupeKey, seenAt, createdAt, updatedAt };
}
