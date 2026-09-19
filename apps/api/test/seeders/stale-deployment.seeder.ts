import { faker } from "@faker-js/faker";

import type { StaleDeploymentsOutput } from "@src/deployment/repositories/deployment/deployment.repository";

export function createStaleDeployment({ dseq = faker.string.numeric({ length: 8 }) }: Partial<StaleDeploymentsOutput> = {}): StaleDeploymentsOutput {
  return {
    dseq
  };
}
