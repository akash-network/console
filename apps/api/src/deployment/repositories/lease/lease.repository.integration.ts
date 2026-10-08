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

  describe("sumLivePricesPerDeployment", () => {
    it("sums the price of every live lease of each deployment the owner holds", async () => {
      const { repository } = setup();
      const [firstProvider, secondProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const owner = createAkashAddress();
      const [web, worker] = await Promise.all([seedDeployment({ owner }), seedDeployment({ owner })]);
      await seedLease(web, { providerAddress: firstProvider, gseq: 1, price: 1.25, denom: "uact" });
      await seedLease(web, { providerAddress: secondProvider, gseq: 2, price: 0.5, denom: "uact" });
      await seedLease(worker, { providerAddress: firstProvider, price: 3, denom: "uact" });

      const found = await repository.sumLivePricesPerDeployment(owner);

      expect(found).toHaveLength(2);
      expect(found).toEqual(
        expect.arrayContaining([
          { dseq: web.dseq, denom: "uact", price: 1.75 },
          { dseq: worker.dseq, denom: "uact", price: 3 }
        ])
      );
    });

    it("leaves out closed leases, and a deployment whose leases are all closed", async () => {
      const { repository } = setup();
      const [openProvider, closedProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const owner = createAkashAddress();
      const [running, closed] = await Promise.all([seedDeployment({ owner }), seedDeployment({ owner })]);
      await seedLease(running, { providerAddress: openProvider, gseq: 1, price: 2, denom: "uact" });
      await seedLease(running, { providerAddress: closedProvider, gseq: 2, price: 5, denom: "uact", closedHeight: 10_000 });
      await seedLease(closed, { providerAddress: openProvider, price: 9, denom: "uact", closedHeight: 10_000 });

      const found = await repository.sumLivePricesPerDeployment(owner);

      expect(found).toEqual([{ dseq: running.dseq, denom: "uact", price: 2 }]);
    });

    it("keeps the leases of a deployment priced in different denoms apart", async () => {
      const { repository } = setup();
      const [firstProvider, secondProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const owner = createAkashAddress();
      const deployment = await seedDeployment({ owner });
      await seedLease(deployment, { providerAddress: firstProvider, gseq: 1, price: 2, denom: "uact" });
      await seedLease(deployment, { providerAddress: secondProvider, gseq: 2, price: 4, denom: "uakt" });

      const found = await repository.sumLivePricesPerDeployment(owner);

      expect(found).toHaveLength(2);
      expect(found).toEqual(
        expect.arrayContaining([
          { dseq: deployment.dseq, denom: "uact", price: 2 },
          { dseq: deployment.dseq, denom: "uakt", price: 4 }
        ])
      );
    });

    it("leaves out the live leases of other owners", async () => {
      const { repository } = setup();
      const provider = await seedProvider();
      const owner = createAkashAddress();
      const [ours, theirs] = await Promise.all([seedDeployment({ owner }), seedDeployment()]);
      await seedLease(ours, { providerAddress: provider, price: 2, denom: "uact" });
      await seedLease(theirs, { providerAddress: provider, price: 8, denom: "uact" });

      const found = await repository.sumLivePricesPerDeployment(owner);

      expect(found).toEqual([{ dseq: ours.dseq, denom: "uact", price: 2 }]);
    });

    it("returns nothing for an owner holding no lease", async () => {
      const { repository } = setup();

      const found = await repository.sumLivePricesPerDeployment(createAkashAddress());

      expect(found).toEqual([]);
    });
  });

  describe("findByDeployments", () => {
    it("returns every lease of the deployments asked about, open or closed, in one read", async () => {
      const { repository } = setup();
      const [firstProvider, secondProvider] = await Promise.all([seedProvider(), seedProvider()]);
      const owner = createAkashAddress();
      const first = await seedDeployment({ owner });
      const second = await seedDeployment({ owner });
      await seedLease(first, { providerAddress: firstProvider, gseq: 1, closedHeight: 10_000 });
      await seedLease(first, { providerAddress: secondProvider, gseq: 2 });
      await seedLease(second, { providerAddress: firstProvider, gseq: 1, closedHeight: 10_000 });

      const leases = await repository.findByDeployments({ owner, dseqs: [first.dseq, second.dseq] });

      expect(leases.map(lease => [lease.dseq, lease.gseq])).toEqual(
        expect.arrayContaining([
          [first.dseq, 1],
          [first.dseq, 2],
          [second.dseq, 1]
        ])
      );
      expect(leases).toHaveLength(3);
    });

    it("leaves out the leases of the owner's other deployments", async () => {
      const { repository } = setup();
      const provider = await seedProvider();
      const owner = createAkashAddress();
      const asked = await seedDeployment({ owner });
      const other = await seedDeployment({ owner });
      await seedLease(asked, { providerAddress: provider });
      await seedLease(other, { providerAddress: provider });

      const leases = await repository.findByDeployments({ owner, dseqs: [asked.dseq] });

      expect(leases.map(lease => lease.dseq)).toEqual([asked.dseq]);
    });

    it("leaves out another owner's lease on the same dseq", async () => {
      const { repository } = setup();
      const provider = await seedProvider();
      const mine = await seedDeployment({ owner: createAkashAddress() });
      const theirs = await seedDeployment({ owner: createAkashAddress(), dseq: mine.dseq });
      await seedLease(mine, { providerAddress: provider });
      await seedLease(theirs, { providerAddress: provider });

      const leases = await repository.findByDeployments({ owner: mine.owner, dseqs: [mine.dseq] });

      expect(leases.map(lease => lease.owner)).toEqual([mine.owner]);
    });

    it("orders a deployment's leases by group and then by order", async () => {
      const { repository } = setup();
      const provider = await seedProvider();
      const deployment = await seedDeployment({ owner: createAkashAddress() });
      await seedLease(deployment, { providerAddress: provider, gseq: 2, oseq: 1 });
      await seedLease(deployment, { providerAddress: provider, gseq: 1, oseq: 2 });
      await seedLease(deployment, { providerAddress: provider, gseq: 1, oseq: 1 });

      const leases = await repository.findByDeployments({ owner: deployment.owner, dseqs: [deployment.dseq] });

      expect(leases.map(lease => [lease.gseq, lease.oseq])).toEqual([
        [1, 1],
        [1, 2],
        [2, 1]
      ]);
    });

    it("returns nothing when no deployment is given", async () => {
      const { repository } = setup();

      await expect(repository.findByDeployments({ owner: createAkashAddress(), dseqs: [] })).resolves.toEqual([]);
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

async function seedDeployment(input: { owner?: string; dseq?: string } = {}) {
  const deployment = await createDeployment({ owner: input.owner ?? createAkashAddress(), dseq: input.dseq ?? faker.string.numeric(10) });
  return { id: deployment.id, owner: deployment.owner, dseq: deployment.dseq };
}

async function seedLease(
  deployment: { id: string; owner: string; dseq: string },
  overrides: { providerAddress: string; gseq?: number; oseq?: number; closedHeight?: number; price?: number; denom?: string }
) {
  const gseq = overrides.gseq ?? 1;
  const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: deployment.owner, dseq: deployment.dseq, gseq });

  return await createLease({
    deploymentId: deployment.id,
    deploymentGroupId: group.id,
    owner: deployment.owner,
    dseq: deployment.dseq,
    gseq,
    oseq: overrides.oseq ?? 1,
    providerAddress: overrides.providerAddress,
    closedHeight: overrides.closedHeight,
    price: overrides.price,
    denom: overrides.denom
  });
}
