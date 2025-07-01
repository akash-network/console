import { DeploymentGroup } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createDeploymentGroup = async (overrides: Partial<CreationAttributes<DeploymentGroup>> = {}): Promise<DeploymentGroup> => {
  return await DeploymentGroup.create({
    id: overrides.id || faker.string.uuid(),
    deploymentId: overrides.deploymentId || faker.string.uuid(),
    owner: overrides.owner || faker.string.alphanumeric(44),
    dseq: overrides.dseq || faker.string.numeric(20),
    gseq: overrides.gseq || faker.number.int({ min: 1, max: 100 })
  });
};
