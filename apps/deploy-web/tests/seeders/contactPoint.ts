import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { faker } from "@faker-js/faker";

export function buildContactPoint(
  overrides?: Partial<components["schemas"]["ContactPointOutput"]["data"]>
): components["schemas"]["ContactPointOutput"]["data"] {
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
    ...overrides
  };
}
