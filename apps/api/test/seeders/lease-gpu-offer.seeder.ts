import type { LeaseGpuOffer } from "@src/deployment/model-schemas";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

export function createLeaseGpuOffer(overrides: Partial<LeaseGpuOffer> = {}): LeaseGpuOffer {
  return {
    gseq: 1,
    oseq: 1,
    provider: createAkashAddress(),
    bseq: 0,
    resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [{ key: "vendor/nvidia/model/rtx4060ti", value: "true" }] }],
    recordedAt: "2026-09-25T10:00:00.000Z",
    ...overrides
  };
}
