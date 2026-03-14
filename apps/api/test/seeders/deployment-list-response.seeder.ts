import { merge } from "lodash";

import type { DeploymentInfoSeederInput } from "./deployment-info.seeder";
import { createManyDeploymentInfoSeeds } from "./deployment-info.seeder";

export function createDeploymentListResponseSeed(input: DeploymentInfoSeederInput = {}, count: number = 1) {
  return merge(
    {
      deployments: createManyDeploymentInfoSeeds(count, input),
      pagination: {
        next_key: null,
        total: count.toString()
      }
    },
    input
  );
}
