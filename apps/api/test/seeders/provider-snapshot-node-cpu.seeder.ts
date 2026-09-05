import { ProviderSnapshotNodeCPU } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createProviderSnapshotNodeCpu = async (overrides: Partial<CreationAttributes<ProviderSnapshotNodeCPU>> = {}): Promise<ProviderSnapshotNodeCPU> => {
  return await ProviderSnapshotNodeCPU.create({
    snapshotNodeId: overrides.snapshotNodeId ?? faker.string.uuid(),
    vendor: overrides.vendor ?? faker.string.alphanumeric(10),
    model: overrides.model ?? faker.string.alphanumeric(10),
    vcores: overrides.vcores ?? faker.number.int({ min: 1, max: 128 }),
    arch: overrides.arch === undefined ? "amd64" : overrides.arch
  });
};
