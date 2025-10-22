import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createLease = async (overrides: Partial<CreationAttributes<Lease>> = {}): Promise<Lease> => {
  return await Lease.create({
    id: overrides.id || faker.string.uuid(),
    deploymentId: overrides.deploymentId || faker.string.uuid(),
    deploymentGroupId: overrides.deploymentGroupId || faker.string.uuid(),
    owner: overrides.owner || faker.string.alphanumeric(44),
    dseq: overrides.dseq || faker.string.numeric(20),
    oseq: overrides.oseq || faker.number.int({ min: 1, max: 100 }),
    gseq: overrides.gseq || faker.number.int({ min: 1, max: 100 }),
    bseq: overrides.bseq || faker.number.int({ min: 0, max: 100 }),
    providerAddress: overrides.providerAddress || faker.string.alphanumeric(44),
    createdHeight: overrides.createdHeight || faker.number.int({ min: 1, max: 10000000 }),
    closedHeight: overrides.closedHeight,
    predictedClosedHeight: overrides.predictedClosedHeight || faker.number.int({ min: 1, max: 10000000 }).toString(),
    price: overrides.price || faker.number.float({ min: 0, max: 100, multipleOf: 0.000001 }),
    withdrawnAmount: overrides.withdrawnAmount || faker.number.float({ min: 0, max: 100, multipleOf: 0.000001 }),
    denom: overrides.denom || faker.helpers.arrayElement(["uakt", "uusdc"]),
    cpuUnits: overrides.cpuUnits || faker.number.int({ min: 1000, max: 10000 }),
    gpuUnits: overrides.gpuUnits || faker.number.int({ min: 0, max: 8 }),
    memoryQuantity: overrides.memoryQuantity || faker.number.int({ min: 1024 * 1024 * 1024, max: 16 * 1024 * 1024 * 1024 }),
    ephemeralStorageQuantity: overrides.ephemeralStorageQuantity || faker.number.int({ min: 1024 * 1024 * 1024, max: 100 * 1024 * 1024 * 1024 }),
    persistentStorageQuantity: overrides.persistentStorageQuantity || faker.number.int({ min: 1024 * 1024 * 1024, max: 1000 * 1024 * 1024 * 1024 })
  });
};
