import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { faker } from "@faker-js/faker";

export function buildNotificationChannel(
  overrides?: Partial<components["schemas"]["NotificationChannelOutput"]["data"]>
): components["schemas"]["NotificationChannelOutput"]["data"] {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    type: "email",
    config: {
      addresses: [faker.internet.email()]
    },
    userId: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    isDefault: faker.datatype.boolean(),
    ...overrides
  };
}
