import { ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export class ProviderSnapshotNodeGpuSeeder {
  static create(overrides: Partial<CreationAttributes<ProviderSnapshotNodeGPU>> = {}): CreationAttributes<ProviderSnapshotNodeGPU> {
    return {
      snapshotNodeId: overrides.snapshotNodeId ?? faker.string.uuid(),
      vendor: overrides.vendor ?? faker.string.alphanumeric(10),
      name: overrides.name ?? faker.string.alphanumeric(10),
      modelId: overrides.modelId ?? faker.string.alphanumeric(10),
      interface: overrides.interface ?? faker.string.alphanumeric(10),
      memorySize: overrides.memorySize ?? faker.string.alphanumeric(10)
    };
  }

  static async createInDatabase(overrides: Partial<CreationAttributes<ProviderSnapshotNodeGPU>> = {}): Promise<ProviderSnapshotNodeGPU> {
    const seed = ProviderSnapshotNodeGpuSeeder.create(overrides);
    return await ProviderSnapshotNodeGPU.create(seed);
  }
}
