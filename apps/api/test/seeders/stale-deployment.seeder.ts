import { faker } from "@faker-js/faker";

import type { StaleDeploymentsOutput } from "@src/deployment/repositories/deployment/deployment.repository";

export function createStaleDeployment({ dseq = faker.number.int({ min: 1, max: 99999999 }) }: Partial<StaleDeploymentsOutput> = {}): StaleDeploymentsOutput {
  return {
    dseq
  };
}
