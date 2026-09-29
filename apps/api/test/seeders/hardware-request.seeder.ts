import { faker } from "@faker-js/faker";

import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export function createHardwareRequest({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  category = "gpu_model",
  gpuModel = "B200",
  quantity = faker.number.int({ min: 1, max: 16 }),
  region = null,
  details = faker.lorem.sentence(),
  contactEmail = faker.internet.email(),
  configuration = null,
  createdAt = faker.date.recent().toISOString()
}: Partial<HardwareRequestOutput> = {}): HardwareRequestOutput {
  return { id, userId, category, gpuModel, quantity, region, details, contactEmail, configuration, createdAt };
}
