import { ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createProviderSnapshotNodeGpu = async (overrides: Partial<CreationAttributes<ProviderSnapshotNodeGPU>> = {}): Promise<ProviderSnapshotNodeGPU> => {
  return await ProviderSnapshotNodeGPU.create({
    snapshotNodeId: overrides.snapshotNodeId ?? faker.string.uuid(),
    vendor: overrides.vendor ?? faker.string.alphanumeric(10),
    name: overrides.name ?? faker.string.alphanumeric(10),
    modelId: overrides.modelId ?? faker.string.alphanumeric(10),
    interface: overrides.interface ?? faker.string.alphanumeric(10),
    memorySize: overrides.memorySize ?? faker.string.alphanumeric(10)
  });
};
