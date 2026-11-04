import { faker } from "@faker-js/faker";

import type { HardwareRequestSpec } from "@src/hardware-request/model-schemas";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export function createHardwareRequest({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  category = "gpu_model",
  gpuModel = "B200",
  quantity = faker.number.int({ min: 1, max: 16 }),
  region = null,
  details = faker.lorem.sentence(),
  contactEmail = faker.internet.email(),
  configuration = null,
  status = "submitted",
  source = null,
  spec = null,
  createdAt = faker.date.recent().toISOString(),
  updatedAt = createdAt
}: Partial<HardwareRequestOutput> = {}): HardwareRequestOutput {
  return { id, userId, organizationId, category, status, source, gpuModel, quantity, region, details, contactEmail, configuration, spec, createdAt, updatedAt };
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
