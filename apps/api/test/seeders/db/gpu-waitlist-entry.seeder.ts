import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { toPoolKey } from "@src/gpu-waitlist/lib/gpu-pool-key/gpu-pool-key";

type GpuWaitlistEntryInsert = ApiPgTables["GpuWaitlistEntries"]["$inferInsert"];

export async function seedGpuWaitlistEntry(overrides: Partial<GpuWaitlistEntryInsert> & Pick<GpuWaitlistEntryInsert, "userId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const vendor = overrides.vendor ?? "nvidia";
  const model = overrides.model ?? faker.helpers.arrayElement(["h100", "a100", "rtx4090"]);
  const [entry] = await db
    .insert(resolveTable("GpuWaitlistEntries"))
    .values({
      vendor,
      model,
      gpuCount: faker.number.int({ min: 1, max: 8 }),
      source: "gpu_menu",
      poolKey: toPoolKey({ vendor, model, memory: overrides.memory, interface: overrides.interface }),
      ...overrides
    })
    .returning();

  return entry;
}
