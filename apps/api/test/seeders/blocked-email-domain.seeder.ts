import { faker } from "@faker-js/faker";

import type { BlockedEmailDomainOutput } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";

export function createBlockedEmailDomain({
  id = faker.string.uuid(),
  domain = faker.internet.domainName().toLowerCase(),
  status = "blocked",
  source = "auto",
  reason = "workload_abuse",
  triggeredByUserId = faker.string.uuid(),
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<BlockedEmailDomainOutput> = {}): BlockedEmailDomainOutput {
  return { id, domain, status, source, reason, triggeredByUserId, createdAt, updatedAt };
}
