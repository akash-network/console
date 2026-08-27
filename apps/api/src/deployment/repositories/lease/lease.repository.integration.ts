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

  describe("findActiveLeasesOfDeployment", () => {
    it("returns every active lease of the deployment, dark provider or not", async () => {
      const { repository } = setup();
      const [darkProvider, healthyProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: darkProvider, gseq: 1 });
      await seedLease(deployment, { providerAddress: healthyProvider, gseq: 2 });

      const found = await repository.findActiveLeasesOfDeployment(deployment.owner, deployment.dseq);

      expect(found.map(lease => lease.providerAddress).sort()).toEqual([darkProvider, healthyProvider].sort());
    });

    it("ignores leases that have already been closed", async () => {
      const { repository } = setup();
      const darkProvider = await seedProvider();
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: darkProvider, closedHeight: 10_000 });

      const found = await repository.findActiveLeasesOfDeployment(deployment.owner, deployment.dseq);

      expect(found).toEqual([]);
    });

    it("leaves out the leases of other deployments the owner holds", async () => {
      const { repository } = setup();
      const darkProvider = await seedProvider();
      const deployment = await seedDeployment();
      const otherDeployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: darkProvider });
      await seedLease(otherDeployment, { providerAddress: darkProvider });

      const found = await repository.findActiveLeasesOfDeployment(deployment.owner, deployment.dseq);

      expect(found).toEqual([{ owner: deployment.owner, dseq: deployment.dseq, providerAddress: darkProvider }]);
    });
  });

  describe("findActiveLeaseRates", () => {
    it("sums the price of every open lease a deployment holds", async () => {
      const { repository } = setup();
      const [firstProvider, secondProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: firstProvider, gseq: 1, price: 30 });
      await seedLease(deployment, { providerAddress: secondProvider, gseq: 2, price: 20 });

      const found = await repository.findActiveLeaseRates(deployment.owner, [deployment.dseq]);

      expect(found).toEqual([{ dseq: deployment.dseq, blockRate: 50 }]);
    });

    it("leaves out closed leases", async () => {
      const { repository } = setup();
      const [openProvider, closedProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: openProvider, gseq: 1, price: 30 });
      await seedLease(deployment, { providerAddress: closedProvider, gseq: 2, price: 20, closedHeight: 10_000 });

      const found = await repository.findActiveLeaseRates(deployment.owner, [deployment.dseq]);

      expect(found).toEqual([{ dseq: deployment.dseq, blockRate: 30 }]);
    });

    it("omits a deployment whose leases are all closed", async () => {
      const { repository } = setup();
      const provider = await seedProvider();
      const deployment = await seedDeployment();
      await seedLease(deployment, { providerAddress: provider, price: 30, closedHeight: 10_000 });

      const found = await repository.findActiveLeaseRates(deployment.owner, [deployment.dseq]);

      expect(found).toEqual([]);
    });

    it("returns nothing when no deployment is given", async () => {
      const { repository } = setup();

      const found = await repository.findActiveLeaseRates(createAkashAddress(), []);

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
  overrides: { providerAddress: string; gseq?: number; closedHeight?: number; price?: number }
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
    closedHeight: overrides.closedHeight,
    price: overrides.price
  });
}
