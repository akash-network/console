import { DeploymentGroup } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export class DeploymentGroupSeeder {
  static create(overrides: Partial<CreationAttributes<DeploymentGroup>> = {}): CreationAttributes<DeploymentGroup> {
    return {
      id: overrides.id || faker.string.uuid(),
      deploymentId: overrides.deploymentId || faker.string.uuid(),
      owner: overrides.owner || faker.string.alphanumeric(44),
      dseq: overrides.dseq || faker.string.numeric(20),
      gseq: overrides.gseq || faker.number.int({ min: 1, max: 100 })
    };
  }

  static async createInDatabase(overrides: Partial<CreationAttributes<DeploymentGroup>> = {}): Promise<DeploymentGroup> {
    const seed = this.create(overrides);
    return await DeploymentGroup.create(seed);
  }
}
