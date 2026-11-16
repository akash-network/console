import { faker } from "@faker-js/faker";

import type { ClosureNoticeOutput } from "@src/modules/alert/repositories/closure-notice/closure-notice.repository";
import { mockAkashAddress } from "./akash-address.seeder";

export const generateClosureNotice = ({
  id = faker.string.uuid(),
  alertId = faker.string.uuid(),
  notificationChannelId = faker.string.uuid(),
  userId = faker.string.uuid(),
  organizationId = null,
  projectId = null,
  owner = mockAkashAddress(),
  dseq = String(faker.number.int({ min: 1, max: 999999 })),
  deploymentLabel = dseq,
  deploymentLink = `<a href="https://console.akash.network/deployments/${dseq}?tab=SETTINGS">console.akash.network</a>`,
  deploymentClosed = true,
  providerLabel = null,
  leaseClosedReason = null,
  createdAt = faker.date.recent(),
  sentAt = null
}: Partial<ClosureNoticeOutput>): ClosureNoticeOutput => ({
  id,
  alertId,
  notificationChannelId,
  userId,
  organizationId,
  projectId,
  owner,
  dseq,
  deploymentLabel,
  deploymentLink,
  deploymentClosed,
  providerLabel,
  leaseClosedReason,
  createdAt,
  sentAt
});
