import { merge } from "lodash";

import type { DeploymentInfoSeederInput } from "./deployment-info.seeder";
import { DeploymentInfoSeeder } from "./deployment-info.seeder";

export class DeploymentListResponseSeeder {
  static create(input: DeploymentInfoSeederInput = {}, count: number = 1) {
    return merge(
      {
        deployments: DeploymentInfoSeeder.createMany(count, input),
        pagination: {
          next_key: null,
          total: count.toString()
        }
      },
      input
    );
  }
}
