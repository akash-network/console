import { DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createDeploymentGroupResource = async (overrides: Partial<CreationAttributes<DeploymentGroupResource>> = {}): Promise<DeploymentGroupResource> => {
  return await DeploymentGroupResource.create({
    deploymentGroupId: overrides.deploymentGroupId || faker.string.uuid(),
    cpuUnits: overrides.cpuUnits || faker.number.int({ min: 1, max: 100 }),
    gpuUnits: overrides.gpuUnits || faker.number.int({ min: 1, max: 100 }),
    gpuVendor: overrides.gpuVendor || faker.company.name(),
    gpuModel: overrides.gpuModel || faker.animal.horse(),
    memoryQuantity: overrides.memoryQuantity || faker.number.int({ min: 1, max: 100 }),
    ephemeralStorageQuantity: overrides.ephemeralStorageQuantity || faker.number.int({ min: 1, max: 100 }),
    persistentStorageQuantity: overrides.persistentStorageQuantity || faker.number.int({ min: 1, max: 100 }),
    count: overrides.count || faker.number.int({ min: 1, max: 100 }),
    price: overrides.price || faker.number.int({ min: 1, max: 100 })
  });
};
