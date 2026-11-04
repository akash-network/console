import { faker } from "@faker-js/faker";

import type { HardwareRequestSpec } from "@src/hardware-request/model-schemas";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export function createHardwareRequest(overrides: Partial<HardwareRequestOutput> = {}): HardwareRequestOutput {
  const createdAt = overrides.createdAt ?? faker.date.recent().toISOString();

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    category: "gpu_model",
    status: "submitted",
    source: null,
    gpuModel: "B200",
    quantity: faker.number.int({ min: 1, max: 16 }),
    region: null,
    details: faker.lorem.sentence(),
    contactEmail: faker.internet.email(),
    configuration: null,
    spec: null,
    lane: null,
    laneReason: null,
    estimatedMonthlyUsd: null,
    owner: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

export function createHardwareRequestSpec(overrides: Partial<HardwareRequestSpec> = {}): HardwareRequestSpec {
  return {
    gpu: { model: "H200", count: 16, interconnect: "cluster", fabric: "infiniband", fabricGbps: 400 },
    region: { mode: "only", areas: ["us", "ca"] },
    uplinkGbps: 10,
    storage: { tbPerNode: 10, nvme: true },
    sla: null,
    targetPrice: { minUsdPerGpuHour: 2.4, maxUsdPerGpuHour: 2.9 },
    term: "12_months",
    start: { kind: "asap" },
    couldGrow: false,
    wantsToTalk: false,
    ...overrides
  };
}
