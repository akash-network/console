import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

type LeaseGpuInsert = ApiPgTables["LeaseGpus"]["$inferInsert"];

export async function seedLeaseGpu(overrides: Partial<LeaseGpuInsert> & Pick<LeaseGpuInsert, "userId" | "dseq" | "gseq" | "oseq" | "provider">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [row] = await db
    .insert(resolveTable("LeaseGpus"))
    .values({
      service: "web",
      source: "nvidia-smi",
      driverVersion: "550.54.15",
      gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }],
      ...overrides
    })
    .returning();

  return row;
}
