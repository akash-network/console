import { ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export class ProviderSnapshotNodeSeeder {
  static create(overrides: Partial<CreationAttributes<ProviderSnapshotNode>> = {}): CreationAttributes<ProviderSnapshotNode> {
    return {
      snapshotId: overrides.snapshotId ?? faker.string.uuid(),
      name: overrides.name ?? faker.string.alphanumeric(10),
      cpuAllocatable: overrides.cpuAllocatable ?? faker.number.int({ min: 0, max: 1000 }),
      cpuAllocated: overrides.cpuAllocated ?? faker.number.int({ min: 0, max: 1000 }),
      memoryAllocatable: overrides.memoryAllocatable ?? faker.number.int({ min: 0, max: 1000 }),
      memoryAllocated: overrides.memoryAllocated ?? faker.number.int({ min: 0, max: 1000 }),
      ephemeralStorageAllocatable: overrides.ephemeralStorageAllocatable ?? faker.number.int({ min: 0, max: 1000 }),
      ephemeralStorageAllocated: overrides.ephemeralStorageAllocated ?? faker.number.int({ min: 0, max: 1000 }),
      capabilitiesStorageHDD: overrides.capabilitiesStorageHDD ?? faker.datatype.boolean(),
      capabilitiesStorageSSD: overrides.capabilitiesStorageSSD ?? faker.datatype.boolean(),
      capabilitiesStorageNVME: overrides.capabilitiesStorageNVME ?? faker.datatype.boolean(),
      gpuAllocatable: overrides.gpuAllocatable ?? faker.number.int({ min: 0, max: 1000 }),
      gpuAllocated: overrides.gpuAllocated ?? faker.number.int({ min: 0, max: 1000 })
    };
  }

  static async createInDatabase(overrides: Partial<CreationAttributes<ProviderSnapshotNode>> = {}): Promise<ProviderSnapshotNode> {
    const seed = ProviderSnapshotNodeSeeder.create(overrides);
    return await ProviderSnapshotNode.create(seed);
  }
}
