import type { Deployment, DeploymentGroup, DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import type { CoreConfig } from "@src/core/providers/config.provider";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { FallbackDeploymentReaderService, UNKNOWN_DB_PLACEHOLDER } from "./fallback-deployment-reader.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(FallbackDeploymentReaderService.name, () => {
  describe("findClosedPage", () => {
    it("reads the page and its count with the query it was given", async () => {
      const { service, deploymentRepository } = setup();
      const query = { owner: createAkashAddress(), skip: 25, limit: 25, reverse: true, search: { dseqContaining: "12", dseqs: ["99"] } };

      await service.findClosedPage(query);

      expect(deploymentRepository.findClosedPage).toHaveBeenCalledWith(query);
    });

    it("answers with the count the index gave", async () => {
      const { service, deploymentRepository } = setup();
      deploymentRepository.findClosedPage.mockResolvedValue({ deployments: [], total: 62 });

      const { total } = await service.findClosedPage({ owner: createAkashAddress(), skip: 0, limit: 25, reverse: true });

      expect(total).toBe(62);
    });

    it("rebuilds each indexed deployment in the shape the chain describes it", async () => {
      const { service, deploymentRepository } = setup();
      const owner = createAkashAddress();
      const resource = indexedResource({
        cpuUnits: 500,
        memoryQuantity: 1024,
        ephemeralStorageQuantity: 2048,
        persistentStorageQuantity: 4096,
        gpuUnits: 1,
        gpuVendor: "nvidia",
        gpuModel: "h100",
        count: 2,
        price: 1.5
      });
      const deployment = indexedDeployment({
        owner,
        dseq: "123",
        createdHeight: 100,
        closedHeight: 200,
        lastWithdrawHeight: 150,
        balance: 0.25,
        withdrawnAmount: 3,
        denom: "uact",
        deploymentGroups: [indexedGroup({ owner, dseq: "123", gseq: 1, deploymentGroupResources: [resource] })]
      });
      deploymentRepository.findClosedPage.mockResolvedValue({ deployments: [deployment], total: 1 });

      const { deployments } = await service.findClosedPage({ owner, skip: 0, limit: 25, reverse: true });

      expect(deployments).toEqual([
        {
          deployment: { id: { owner, dseq: "123" }, state: "closed", hash: UNKNOWN_DB_PLACEHOLDER, created_at: "100" },
          groups: [
            {
              id: { owner, dseq: "123", gseq: 1 },
              state: "closed",
              group_spec: {
                name: UNKNOWN_DB_PLACEHOLDER,
                requirements: { signed_by: { all_of: [], any_of: [] }, attributes: [] },
                resources: [
                  {
                    resource: {
                      id: 1,
                      cpu: { units: { val: "500" }, attributes: [] },
                      memory: { quantity: { val: "1024" }, attributes: [] },
                      storage: [{ name: "default", quantity: { val: "6144" }, attributes: [] }],
                      gpu: { units: { val: "1" }, attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] },
                      endpoints: [{ kind: "SHARED_HTTP", sequence_number: 0 }]
                    },
                    count: 2,
                    price: { denom: "uact", amount: "1.500000000000000000" }
                  }
                ]
              },
              created_at: "100"
            }
          ],
          escrow_account: {
            id: { scope: "deployment", xid: `${owner}/123` },
            state: {
              owner,
              state: "closed",
              transferred: [{ denom: "uact", amount: "3.000000000000000000" }],
              settled_at: "150",
              funds: [{ denom: "uact", amount: "0.250000000000000000" }],
              deposits: [{ owner, height: "100", source: "balance", balance: { denom: "uact", amount: "0.250000000000000000" } }]
            }
          }
        }
      ]);
    });
  });

  describe("findAll", () => {
    it("reports an open deployment as active with an open escrow account", async () => {
      const { service, deploymentRepository } = setup();
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({ count: 1, rows: [indexedDeployment({ closedHeight: undefined })] });

      const { deployments } = await service.findAll({ owner: createAkashAddress() });

      expect(deployments[0].deployment.state).toBe("active");
      expect(deployments[0].escrow_account.state.state).toBe("open");
    });

    it("dates the escrow settlement from the creation when the deployment was never withdrawn from", async () => {
      const { service, deploymentRepository } = setup();
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({
        count: 1,
        rows: [indexedDeployment({ createdHeight: 100, lastWithdrawHeight: undefined })]
      });

      const { deployments } = await service.findAll({ owner: createAkashAddress() });

      expect(deployments[0].escrow_account.state.settled_at).toBe("100");
    });

    it("falls back to empty ids and to uakt for a row the index left them out of", async () => {
      const { service, deploymentRepository } = setup();
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({
        count: 1,
        rows: [indexedDeployment({ owner: undefined, dseq: undefined, denom: undefined })]
      });

      const { deployments } = await service.findAll({ owner: createAkashAddress() });

      expect(deployments[0].deployment.id).toEqual({ owner: "", dseq: "" });
      expect(deployments[0].escrow_account.id.xid).toBe("/");
      expect(deployments[0].escrow_account.state.owner).toBe("");
      expect(deployments[0].escrow_account.state.funds[0].denom).toBe("uakt");
    });

    it("reports a usdc deployment under the denom the chain holds it in", async () => {
      const { service, deploymentRepository } = setup({ network: "sandbox" });
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({ count: 1, rows: [indexedDeployment({ denom: "uusdc" })] });

      const { deployments } = await service.findAll({ owner: createAkashAddress() });

      expect(deployments[0].escrow_account.state.funds[0].denom).toBe(USDC_IBC_DENOMS.sandboxId);
    });

    it("names a gpu the chain left to any model with the wildcard it used", async () => {
      const { service, deploymentRepository } = setup();
      const groups = [indexedGroup({ deploymentGroupResources: [indexedResource({ gpuUnits: 1, gpuVendor: "nvidia", gpuModel: undefined })] })];
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({ count: 1, rows: [indexedDeployment({ deploymentGroups: groups })] });

      const { deployments } = await service.findAll({ owner: createAkashAddress() });

      expect(deployments[0].groups[0].group_spec.resources[0].resource.gpu.attributes).toEqual([{ key: "vendor/nvidia/model/*", value: "true" }]);
    });

    it("names no gpu for a resource the index recorded no vendor for", async () => {
      const { service, deploymentRepository } = setup();
      const groups = [indexedGroup({ deploymentGroupResources: [indexedResource({ gpuUnits: 0, gpuVendor: undefined, gpuModel: undefined })] })];
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({ count: 1, rows: [indexedDeployment({ deploymentGroups: groups })] });

      const { deployments } = await service.findAll({ owner: createAkashAddress() });

      expect(deployments[0].groups[0].group_spec.resources[0].resource.gpu.attributes).toEqual([]);
    });
  });

  describe("findByOwnerAndDseq", () => {
    it("rebuilds the deployment the index holds in the shape the chain describes it", async () => {
      const { service, deploymentRepository } = setup();
      const owner = createAkashAddress();
      const deployment = indexedDeployment({ owner, closedHeight: undefined });
      deploymentRepository.findByIdWithGroups.mockResolvedValue(deployment);
      deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({ count: 1, rows: [deployment] });

      const found = await service.findByOwnerAndDseq(owner, deployment.dseq);
      const { deployments } = await service.findAll({ owner });

      expect(found).toEqual(deployments[0]);
    });

    it("answers null for a deployment the index does not hold", async () => {
      const { service, deploymentRepository } = setup();
      deploymentRepository.findByIdWithGroups.mockResolvedValue(null);

      await expect(service.findByOwnerAndDseq(createAkashAddress(), faker.string.numeric(12))).resolves.toBeNull();
    });
  });

  function setup(input: { network?: CoreConfig["NETWORK"] } = {}) {
    const deploymentRepository = mock<DeploymentRepository>({ findClosedPage: vi.fn().mockResolvedValue({ deployments: [], total: 0 }) });
    const coreConfig = mock<CoreConfig>({ NETWORK: input.network ?? "mainnet" });
    const service = new FallbackDeploymentReaderService(deploymentRepository, coreConfig);

    return { service, deploymentRepository };
  }

  function indexedDeployment(overrides: Partial<Deployment> = {}) {
    return mock<Deployment>({
      owner: createAkashAddress(),
      dseq: faker.string.numeric(12),
      createdHeight: faker.number.int({ min: 1, max: 1_000_000 }),
      closedHeight: faker.number.int({ min: 1_000_001, max: 2_000_000 }),
      lastWithdrawHeight: faker.number.int({ min: 1, max: 1_000_000 }),
      balance: faker.number.float({ min: 0, max: 1000 }),
      withdrawnAmount: faker.number.float({ min: 0, max: 1000 }),
      denom: "uact",
      deploymentGroups: [],
      ...overrides
    });
  }

  function indexedGroup(overrides: Partial<DeploymentGroup> = {}) {
    return mock<DeploymentGroup>({
      owner: createAkashAddress(),
      dseq: faker.string.numeric(12),
      gseq: 1,
      deploymentGroupResources: [],
      ...overrides
    });
  }

  function indexedResource(overrides: Partial<DeploymentGroupResource> = {}) {
    return mock<DeploymentGroupResource>({
      cpuUnits: 1000,
      memoryQuantity: 1024,
      ephemeralStorageQuantity: 1024,
      persistentStorageQuantity: 0,
      gpuUnits: 0,
      gpuVendor: undefined,
      gpuModel: undefined,
      count: 1,
      price: 1,
      ...overrides
    });
  }
});
