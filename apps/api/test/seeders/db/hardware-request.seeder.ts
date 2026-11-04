import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

type HardwareRequestInsert = ApiPgTables["HardwareRequests"]["$inferInsert"];

export async function seedHardwareRequest(overrides: Partial<HardwareRequestInsert> & Pick<HardwareRequestInsert, "userId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [hardwareRequest] = await db
    .insert(resolveTable("HardwareRequests"))
    .values({
      category: "gpu_model",
      gpuModel: "H100",
      quantity: faker.number.int({ min: 1, max: 16 }),
      contactEmail: faker.internet.email(),
      ...overrides
    })
    .returning();

  return hardwareRequest;
}
