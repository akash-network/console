import type { components } from "@akashnetwork/console-api-types/notifications";
import { faker } from "@faker-js/faker";

export function buildNotificationChannel(
  overrides?: Partial<components["schemas"]["NotificationChannelOutput"]["data"]>
): components["schemas"]["NotificationChannelOutput"]["data"] {
  const createdAt = faker.date.past();
  const updatedAt = faker.date.between({ from: createdAt, to: new Date() });
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    type: "email",
    config: {
      addresses: [faker.internet.email()]
    },
    userId: faker.string.uuid(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    isDefault: faker.datatype.boolean(),
    ...overrides
  };
}
