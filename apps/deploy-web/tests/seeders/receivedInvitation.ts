import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";

import type { ReceivedInvitationOutput } from "@src/types/organizationMembership";

export const buildReceivedInvitation = (overrides: Partial<ReceivedInvitationOutput> = {}): ReceivedInvitationOutput => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  organizationName: faker.company.name(),
  inviterName: faker.internet.username(),
  role: "member",
  createdAt: faker.date.recent().toISOString(),
  expiresAt: addDays(new Date(), 7).toISOString(),
  ...overrides
});
