import type { LeaseGpuReading } from "@src/deployment/model-schemas";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

export function createLeaseGpuReading(overrides: Partial<LeaseGpuReading> = {}): LeaseGpuReading {
  return {
    gseq: 1,
    oseq: 1,
    provider: createAkashAddress(),
    service: "web",
    gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }],
    driverVersion: "550.54.15",
    source: "nvidia-smi",
    detectedAt: "2026-09-21T10:00:00.000Z",
    ...overrides
  };
}
