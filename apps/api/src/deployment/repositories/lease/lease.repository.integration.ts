import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { beforeAll, describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { LeaseRepository } from "./lease.repository";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

describe(LeaseRepository.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  describe("findActiveLeasesOfDeploymentsOnProviders", () => {
    it("returns the active lease a deployment holds on an unreachable provider", async () => {
      const { repository } = setup();
      const darkProvider = await seedProvider();
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: darkProvider });

      const found = await repository.findActiveLeasesOfDeploymentsOnProviders([darkProvider]);

      expect(found).toContainEqual({ owner: deployment.owner, dseq: deployment.dseq, providerAddress: darkProvider });
    });

    it("also returns the leases that deployment holds on providers that are still answering", async () => {
      const { repository } = setup();
      const [darkProvider, healthyProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: darkProvider, gseq: 1 });
      await seedLease(deployment, { providerAddress: healthyProvider, gseq: 2 });

      const found = await repository.findActiveLeasesOfDeploymentsOnProviders([darkProvider]);

      const ours = found.filter(lease => lease.owner === deployment.owner);
      expect(ours.map(lease => lease.providerAddress).sort()).toEqual([darkProvider, healthyProvider].sort());
    });

    it("ignores leases that have already been closed", async () => {
      const { repository } = setup();
      const darkProvider = await seedProvider();
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: darkProvider, closedHeight: 10_000 });

      const found = await repository.findActiveLeasesOfDeploymentsOnProviders([darkProvider]);

      expect(found.map(row => row.owner)).not.toContain(deployment.owner);
    });

    it("leaves out deployments that never touched an unreachable provider", async () => {
      const { repository } = setup();
      const [darkProvider, healthyProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: healthyProvider });

      const found = await repository.findActiveLeasesOfDeploymentsOnProviders([darkProvider]);

      expect(found.map(row => row.owner)).not.toContain(deployment.owner);
    });

    it("returns nothing when no provider is unreachable", async () => {
      const { repository } = setup();

      const found = await repository.findActiveLeasesOfDeploymentsOnProviders([]);

      expect(found).toEqual([]);
    });
  });

  function setup() {
    return { repository: container.resolve(LeaseRepository) };
  }
});

async function seedProvider() {
  const provider = await createProvider();
  return provider.owner;
}

async function seedDeployment() {
  const deployment = await createDeployment({ owner: createAkashAddress(), dseq: faker.string.numeric(10) });
  return { id: deployment.id, owner: deployment.owner, dseq: deployment.dseq };
}

async function seedLease(
  deployment: { id: string; owner: string; dseq: string },
  overrides: { providerAddress: string; gseq?: number; closedHeight?: number }
) {
  const gseq = overrides.gseq ?? 1;
  const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: deployment.owner, dseq: deployment.dseq, gseq });

  return await createLease({
    deploymentId: deployment.id,
    deploymentGroupId: group.id,
    owner: deployment.owner,
    dseq: deployment.dseq,
    gseq,
    oseq: 1,
    providerAddress: overrides.providerAddress,
    closedHeight: overrides.closedHeight
  });
}
