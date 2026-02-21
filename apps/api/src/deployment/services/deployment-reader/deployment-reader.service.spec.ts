import type { DeploymentHttpService, DeploymentListResponse, LeaseHttpService, RestAkashLeaseListResponse } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { FallbackDeploymentReaderService } from "@src/deployment/services/fallback-deployment-reader/fallback-deployment-reader.service";
import type { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import type { MessageService } from "@src/deployment/services/message-service/message.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderList } from "@src/types/provider";
import { DeploymentReaderService } from "./deployment-reader.service";

describe(DeploymentReaderService.name, () => {
  describe("listWithResources", () => {
    it("returns count from database instead of Cosmos SDK pagination total", async () => {
      const address = faker.string.alphanumeric(44);
      const dbCount = 42;
      const cosmosTotal = "10";

      const { service, deploymentRepository } = setup({
        deploymentsResponse: createDeploymentsResponse({ total: cosmosTotal }),
        leaseResponse: createEmptyLeaseResponse(),
        dbCount
      });

      const result = await service.listWithResources({ address });

      expect(deploymentRepository.countByOwner).toHaveBeenCalledWith(address, undefined);
      expect(result.count).toBe(dbCount);
    });

    it("passes status filter to countByOwner for active deployments", async () => {
      const address = faker.string.alphanumeric(44);
      const dbCount = 15;

      const { service, deploymentRepository } = setup({
        deploymentsResponse: createDeploymentsResponse(),
        leaseResponse: createEmptyLeaseResponse(),
        dbCount
      });

      const result = await service.listWithResources({ address, status: "active" });

      expect(deploymentRepository.countByOwner).toHaveBeenCalledWith(address, "active");
      expect(result.count).toBe(dbCount);
    });

    it("passes status filter to countByOwner for closed deployments", async () => {
      const address = faker.string.alphanumeric(44);
      const dbCount = 27;

      const { service, deploymentRepository } = setup({
        deploymentsResponse: createDeploymentsResponse(),
        leaseResponse: createEmptyLeaseResponse(),
        dbCount
      });

      const result = await service.listWithResources({ address, status: "closed" });

      expect(deploymentRepository.countByOwner).toHaveBeenCalledWith(address, "closed");
      expect(result.count).toBe(dbCount);
    });

    it("returns deployment results mapped with resource fields", async () => {
      const address = faker.string.alphanumeric(44);
      const dseq = faker.string.numeric(6);
      const deploymentsResponse = createDeploymentsResponse({
        deployments: [createDeploymentInfo({ owner: address, dseq })]
      });

      const { service } = setup({
        deploymentsResponse,
        leaseResponse: createEmptyLeaseResponse(),
        dbCount: 1
      });

      const result = await service.listWithResources({ address });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].owner).toBe(address);
      expect(result.results[0].dseq).toBe(dseq);
    });

    it("fetches providers when deployments exist", async () => {
      const address = faker.string.alphanumeric(44);
      const deploymentsResponse = createDeploymentsResponse({
        deployments: [createDeploymentInfo({ owner: address })]
      });

      const { service, providerService } = setup({
        deploymentsResponse,
        leaseResponse: createEmptyLeaseResponse(),
        dbCount: 1
      });

      await service.listWithResources({ address });

      expect(providerService.getProviderList).toHaveBeenCalled();
    });

    it("skips provider fetch when no deployments", async () => {
      const address = faker.string.alphanumeric(44);

      const { service, providerService } = setup({
        deploymentsResponse: createDeploymentsResponse({ deployments: [] }),
        leaseResponse: createEmptyLeaseResponse(),
        dbCount: 0
      });

      await service.listWithResources({ address });

      expect(providerService.getProviderList).not.toHaveBeenCalled();
    });

    it("passes pagination params to deployments list", async () => {
      const address = faker.string.alphanumeric(44);

      const { service, deploymentHttpService } = setup({
        deploymentsResponse: createDeploymentsResponse(),
        leaseResponse: createEmptyLeaseResponse(),
        dbCount: 0
      });

      await service.listWithResources({ address, skip: 10, limit: 5, reverseSorting: true });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith({
        owner: address,
        state: undefined,
        pagination: {
          offset: 10,
          limit: 5,
          reverse: true,
          countTotal: false
        }
      });
    });
  });

  function setup(input: { deploymentsResponse: DeploymentListResponse; leaseResponse: RestAkashLeaseListResponse; dbCount: number }) {
    const providerService = mock<ProviderService>({
      getProviderList: jest.fn().mockResolvedValue([] as ProviderList[])
    });
    const deploymentHttpService = mock<DeploymentHttpService>({
      findAll: jest.fn().mockResolvedValue(input.deploymentsResponse)
    });
    const leaseHttpService = mock<LeaseHttpService>({
      list: jest.fn().mockResolvedValue(input.leaseResponse)
    });
    const deploymentRepository = mock<DeploymentRepository>({
      countByOwner: jest.fn().mockResolvedValue(input.dbCount)
    });

    const service = new DeploymentReaderService(
      providerService,
      deploymentHttpService,
      mock<FallbackDeploymentReaderService>(),
      leaseHttpService,
      mock<FallbackLeaseReaderService>(),
      mock<MessageService>(),
      mock<WalletReaderService>(),
      deploymentRepository,
      mock<LoggerService>()
    );

    return { service, providerService, deploymentHttpService, leaseHttpService, deploymentRepository };
  }
});

function createDeploymentsResponse(overrides?: { deployments?: DeploymentListResponse["deployments"]; total?: string }): DeploymentListResponse {
  return {
    deployments: overrides?.deployments ?? [],
    pagination: {
      next_key: null,
      total: overrides?.total ?? "0"
    }
  };
}

function createEmptyLeaseResponse(): RestAkashLeaseListResponse {
  return {
    leases: [],
    pagination: {
      next_key: null,
      total: "0"
    }
  };
}

function createDeploymentInfo(overrides?: { owner?: string; dseq?: string }): DeploymentListResponse["deployments"][number] {
  const owner = overrides?.owner ?? faker.string.alphanumeric(44);
  const dseq = overrides?.dseq ?? faker.string.numeric(6);

  return {
    deployment: {
      id: { owner, dseq },
      state: "active",
      hash: faker.string.hexadecimal({ length: 64 }),
      created_at: faker.string.numeric(7)
    },
    groups: [
      {
        id: { owner, dseq, gseq: 1 },
        state: "open",
        group_spec: {
          name: "default",
          requirements: {
            signed_by: { all_of: [], any_of: [] },
            attributes: []
          },
          resources: [
            {
              resource: {
                id: 1,
                cpu: { units: { val: "1000" }, attributes: [] },
                memory: { quantity: { val: "536870912" }, attributes: [] },
                storage: [{ name: "default", quantity: { val: "1073741824" }, attributes: [] }],
                gpu: { units: { val: "0" }, attributes: [] },
                endpoints: []
              },
              count: 1,
              price: { denom: "uakt", amount: "1000" }
            }
          ]
        },
        created_at: faker.string.numeric(7)
      }
    ],
    escrow_account: {
      id: { scope: "deployment", xid: `${owner}/${dseq}` },
      state: {
        owner,
        state: "open",
        transferred: [{ denom: "uakt", amount: "0" }],
        settled_at: faker.string.numeric(7),
        funds: [{ denom: "uakt", amount: "5000000" }],
        deposits: [{ owner, height: faker.string.numeric(7), source: "", balance: { denom: "uakt", amount: "5000000" } }]
      }
    }
  };
}
