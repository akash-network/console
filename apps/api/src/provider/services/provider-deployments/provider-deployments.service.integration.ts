import type { Lease } from "@akashnetwork/database/dbSchemas/akash";
import type { Block } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";
import { container } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { ProviderDeploymentsService } from "./provider-deployments.service";

import { createAkashAddress, createAkashBlock, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

function uniqueHeight() {
  return faker.number.int({ min: 20_000_000, max: 2_000_000_000 });
}

describe(ProviderDeploymentsService.name, () => {
  describe("getProviderDeployments", () => {
    it("returns deployments with lease details for a provider", async () => {
      const createdHeight = uniqueHeight();
      const closedHeight = createdHeight + 1000;
      const { service, providerAddress, owner, blocks } = await setup({
        blocks: [
          { height: createdHeight, datetime: new Date("2024-01-01") },
          { height: closedHeight, datetime: new Date("2024-01-15") }
        ],
        deployments: [
          {
            createdHeight,
            denom: "uakt",
            balance: 500,
            withdrawnAmount: 100,
            lastWithdrawHeight: createdHeight + 500,
            leaseOverrides: {
              createdHeight,
              closedHeight,
              price: 0.5,
              cpuUnits: 1000,
              gpuUnits: 1,
              memoryQuantity: 1073741824,
              ephemeralStorageQuantity: 5368709120,
              persistentStorageQuantity: 10737418240,
              gseq: 1,
              oseq: 1
            }
          }
        ]
      });

      const result = await service.getProviderDeployments(providerAddress, 0, 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        owner,
        denom: "uakt",
        createdHeight,
        createdDate: blocks[0].datetime,
        status: "active",
        balance: 500,
        transferred: 100,
        settledAt: createdHeight + 500,
        resources: {
          cpu: 1000,
          gpu: 1,
          memory: 1073741824,
          ephemeralStorage: 5368709120,
          persistentStorage: 10737418240
        }
      });
      expect(result[0].leases).toHaveLength(1);
      expect(result[0].leases[0]).toMatchObject({
        provider: providerAddress,
        gseq: 1,
        oseq: 1,
        price: 0.5,
        createdHeight,
        createdDate: blocks[0].datetime,
        closedHeight,
        closedDate: blocks[1].datetime,
        status: "closed"
      });
    });

    it("filters by active status", async () => {
      const height1 = uniqueHeight();
      const height2 = uniqueHeight();
      const { service, providerAddress } = await setup({
        blocks: [{ height: height1 }, { height: height2 }],
        deployments: [
          { createdHeight: height1, leaseOverrides: { createdHeight: height1, closedHeight: undefined } },
          { createdHeight: height2, closedHeight: height2, leaseOverrides: { createdHeight: height2, closedHeight: height2 } }
        ]
      });

      const activeResult = await service.getProviderDeployments(providerAddress, 0, 10, "active");
      expect(activeResult).toHaveLength(1);
      expect(activeResult[0].status).toBe("active");

      const closedResult = await service.getProviderDeployments(providerAddress, 0, 10, "closed");
      expect(closedResult).toHaveLength(1);
      expect(closedResult[0].status).toBe("closed");
    });

    it("paginates results ordered by createdHeight DESC", async () => {
      const baseHeight = uniqueHeight();
      const { service, providerAddress } = await setup({
        blocks: [{ height: baseHeight }, { height: baseHeight + 100 }, { height: baseHeight + 200 }],
        deployments: [
          { createdHeight: baseHeight, leaseOverrides: { createdHeight: baseHeight } },
          { createdHeight: baseHeight + 100, leaseOverrides: { createdHeight: baseHeight + 100 } },
          { createdHeight: baseHeight + 200, leaseOverrides: { createdHeight: baseHeight + 200 } }
        ]
      });

      const firstPage = await service.getProviderDeployments(providerAddress, 0, 2);
      expect(firstPage).toHaveLength(2);
      expect(firstPage[0].createdHeight).toBe(baseHeight + 200);
      expect(firstPage[1].createdHeight).toBe(baseHeight + 100);

      const secondPage = await service.getProviderDeployments(providerAddress, 2, 2);
      expect(secondPage).toHaveLength(1);
      expect(secondPage[0].createdHeight).toBe(baseHeight);
    });

    it("excludes deployments from other providers", async () => {
      const height = uniqueHeight();
      const otherProvider = createAkashAddress();
      const { service, providerAddress, owner } = await setup({
        blocks: [{ height }],
        deployments: [{ createdHeight: height, leaseOverrides: { createdHeight: height } }]
      });

      await createProvider({ owner: otherProvider });
      await seedLeaseWithDeployment({ owner, providerAddress: otherProvider, createdHeight: height, leaseOverrides: { createdHeight: height } });

      const result = await service.getProviderDeployments(providerAddress, 0, 10);
      expect(result).toHaveLength(1);
      expect(result[0].leases[0].provider).toBe(providerAddress);
    });

    it("aggregates resources from multiple leases", async () => {
      const height = uniqueHeight();
      const { service, providerAddress } = await setup({
        blocks: [{ height }],
        deployments: []
      });

      const owner = createAkashAddress();
      const deployment = await createDeployment({ owner, createdHeight: height });
      const deploymentGroup1 = await createDeploymentGroup({ deploymentId: deployment.id, owner, dseq: deployment.dseq });
      const deploymentGroup2 = await createDeploymentGroup({ deploymentId: deployment.id, owner, dseq: deployment.dseq, gseq: 2 });

      await createLease({
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup1.id,
        owner,
        dseq: deployment.dseq,
        providerAddress,
        createdHeight: height,
        cpuUnits: 1000,
        gpuUnits: 1,
        memoryQuantity: 1073741824,
        ephemeralStorageQuantity: 5368709120,
        persistentStorageQuantity: 10737418240,
        gseq: 1,
        oseq: 1
      });

      await createLease({
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup2.id,
        owner,
        dseq: deployment.dseq,
        providerAddress,
        createdHeight: height,
        cpuUnits: 2000,
        gpuUnits: 2,
        memoryQuantity: 2147483648,
        ephemeralStorageQuantity: 10737418240,
        persistentStorageQuantity: 21474836480,
        gseq: 2,
        oseq: 1
      });

      const result = await service.getProviderDeployments(providerAddress, 0, 10);

      expect(result).toHaveLength(1);
      expect(result[0].resources).toEqual({
        cpu: 3000,
        gpu: 3,
        memory: 1073741824 + 2147483648,
        ephemeralStorage: 5368709120 + 10737418240,
        persistentStorage: 10737418240 + 21474836480
      });
      expect(result[0].leases).toHaveLength(2);
    });

    it("does not count multiple leases per deployment as separate pagination entries", async () => {
      const baseHeight = uniqueHeight();
      const { service, providerAddress } = await setup({
        blocks: [{ height: baseHeight }, { height: baseHeight + 100 }],
        deployments: []
      });

      const owner = createAkashAddress();

      const deployment1 = await createDeployment({ owner, createdHeight: baseHeight });
      const dg1a = await createDeploymentGroup({ deploymentId: deployment1.id, owner, dseq: deployment1.dseq, gseq: 1 });
      const dg1b = await createDeploymentGroup({ deploymentId: deployment1.id, owner, dseq: deployment1.dseq, gseq: 2 });
      await createLease({
        deploymentId: deployment1.id,
        deploymentGroupId: dg1a.id,
        owner,
        dseq: deployment1.dseq,
        providerAddress,
        createdHeight: baseHeight,
        gseq: 1,
        oseq: 1
      });
      await createLease({
        deploymentId: deployment1.id,
        deploymentGroupId: dg1b.id,
        owner,
        dseq: deployment1.dseq,
        providerAddress,
        createdHeight: baseHeight,
        gseq: 2,
        oseq: 1
      });

      const deployment2 = await createDeployment({ owner, createdHeight: baseHeight + 100 });
      const dg2 = await createDeploymentGroup({ deploymentId: deployment2.id, owner, dseq: deployment2.dseq, gseq: 1 });
      await createLease({
        deploymentId: deployment2.id,
        deploymentGroupId: dg2.id,
        owner,
        dseq: deployment2.dseq,
        providerAddress,
        createdHeight: baseHeight + 100,
        gseq: 1,
        oseq: 1
      });

      const firstPage = await service.getProviderDeployments(providerAddress, 0, 1);
      expect(firstPage).toHaveLength(1);
      expect(firstPage[0].dseq).toBe(deployment2.dseq);

      const secondPage = await service.getProviderDeployments(providerAddress, 1, 1);
      expect(secondPage).toHaveLength(1);
      expect(secondPage[0].dseq).toBe(deployment1.dseq);
      expect(secondPage[0].leases).toHaveLength(2);
    });
  });

  describe("getProviderDeploymentsCount", () => {
    it("returns total count of deployments for a provider", async () => {
      const height1 = uniqueHeight();
      const height2 = uniqueHeight();
      const { service, providerAddress } = await setup({
        blocks: [{ height: height1 }, { height: height2 }],
        deployments: [
          { createdHeight: height1, leaseOverrides: { createdHeight: height1 } },
          { createdHeight: height2, leaseOverrides: { createdHeight: height2 } }
        ]
      });

      const count = await service.getProviderDeploymentsCount(providerAddress);
      expect(count).toBe(2);
    });

    it("filters count by status", async () => {
      const height1 = uniqueHeight();
      const height2 = uniqueHeight();
      const { service, providerAddress } = await setup({
        blocks: [{ height: height1 }, { height: height2 }],
        deployments: [
          { createdHeight: height1, leaseOverrides: { createdHeight: height1, closedHeight: undefined } },
          { createdHeight: height2, closedHeight: height2, leaseOverrides: { createdHeight: height2, closedHeight: height2 } }
        ]
      });

      const activeCount = await service.getProviderDeploymentsCount(providerAddress, "active");
      expect(activeCount).toBe(1);

      const closedCount = await service.getProviderDeploymentsCount(providerAddress, "closed");
      expect(closedCount).toBe(1);
    });
  });

  async function setup(input: {
    blocks: Partial<CreationAttributes<Block>>[];
    deployments: (Omit<SeedLeaseWithDeploymentInput, "owner" | "providerAddress"> & { closedHeight?: number })[];
  }) {
    container.resolve(CHAIN_DB);

    const providerAddress = createAkashAddress();
    const owner = createAkashAddress();

    const blocks = await Promise.all(input.blocks.map(b => createAkashBlock(b)));
    await createProvider({ owner: providerAddress });

    for (const dep of input.deployments) {
      await seedLeaseWithDeployment({ owner, providerAddress, ...dep });
    }

    return {
      service: new ProviderDeploymentsService(),
      providerAddress,
      owner,
      blocks
    };
  }
});

interface SeedLeaseWithDeploymentInput {
  owner: string;
  providerAddress: string;
  createdHeight: number;
  closedHeight?: number;
  denom?: string;
  balance?: number;
  withdrawnAmount?: number;
  lastWithdrawHeight?: number;
  leaseOverrides?: Partial<CreationAttributes<Lease>>;
}

async function seedLeaseWithDeployment(input: SeedLeaseWithDeploymentInput) {
  const deployment = await createDeployment({
    owner: input.owner,
    createdHeight: input.createdHeight,
    closedHeight: input.closedHeight,
    denom: input.denom || "uakt",
    balance: input.balance ?? 1000,
    withdrawnAmount: input.withdrawnAmount ?? 0,
    lastWithdrawHeight: input.lastWithdrawHeight
  });
  const deploymentGroup = await createDeploymentGroup({
    deploymentId: deployment.id,
    owner: input.owner,
    dseq: deployment.dseq
  });

  const lease = await createLease({
    deploymentId: deployment.id,
    deploymentGroupId: deploymentGroup.id,
    owner: input.owner,
    dseq: deployment.dseq,
    providerAddress: input.providerAddress,
    ...input.leaseOverrides
  });

  return { deployment, deploymentGroup, lease };
}
