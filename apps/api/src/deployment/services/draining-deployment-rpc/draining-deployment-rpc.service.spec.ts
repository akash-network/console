import "@test/mocks/logger-service.mock";

import type { DeploymentHttpService, DeploymentListResponse, LeaseHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { LoggerService } from "@src/core";
import { DrainingDeploymentRpcService } from "./draining-deployment-rpc.service";

import { createAkashAddress } from "@test/seeders";
import { DeploymentListResponseSeeder } from "@test/seeders/deployment-list-response.seeder";
import { LeaseApiResponseSeeder } from "@test/seeders/lease-api-response.seeder";

describe(DrainingDeploymentRpcService.name, () => {
  describe("findManyByDseqAndOwner", () => {
    it("returns draining deployments with predicted closed height", async () => {
      const input = {
        leases: [{ blockRate: 50 }],
        deployment: {
          createdHeight: 995000,
          funds: 40000,
          transferred: 20000
        }
      };

      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [input]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        dseq: Number(dseqs[0]),
        owner,
        denom: "uakt",
        blockRate: input.leases[0].blockRate,
        predictedClosedHeight: Math.ceil(input.deployment.createdHeight + (input.deployment.funds + input.deployment.transferred) / input.leases[0].blockRate)
      });
    });

    it("filters deployments by closureHeight", async () => {
      const activeInput = {
        leases: [{ blockRate: 50 }],
        deployment: {
          dseq: faker.string.numeric(6),
          createdHeight: 995000,
          funds: 40000,
          transferred: 20000
        }
      };
      const filteredInput = {
        leases: [{ blockRate: 50 }],
        deployment: {
          createdHeight: 995000,
          funds: 250000,
          transferred: 20000
        }
      };

      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [activeInput, filteredInput]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(1);
      expect(result[0].dseq).toBe(Number(activeInput.deployment.dseq));
    });

    it("sums block rates for multiple leases with same dseq", async () => {
      const input = {
        leases: [
          { blockRate: 30, gseq: 0 },
          { blockRate: 20, gseq: 1 }
        ],
        deployment: {
          createdHeight: 995000,
          funds: 40000,
          transferred: 20000
        }
      };
      const totalBlockRate = input.leases[0].blockRate + input.leases[1].blockRate;

      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [input]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(1);
      expect(result[0].blockRate).toBe(totalBlockRate);
    });

    it("excludes deployments without matching lease data", async () => {
      const { service, loggerService, owner, dseqs, closureHeight } = setup({
        inputs: [
          {
            leases: [{ blockRate: 50 }],
            deployment: undefined
          }
        ]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(0);
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DEPLOYMENT_NOT_FOUND",
          dseq: Number(dseqs[0]),
          owner
        })
      );
    });

    it("excludes deployments with zero balance", async () => {
      const { service, loggerService, owner, dseqs, closureHeight } = setup({
        inputs: [
          {
            leases: [{ blockRate: 50 }],
            deployment: {
              createdHeight: 995000,
              funds: 0,
              transferred: 0
            }
          }
        ]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(0);
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DEPLOYMENT_HAS_NO_BALANCE",
          dseq: Number(dseqs[0]),
          owner
        })
      );
    });

    it("excludes deployments with invalid block rate", async () => {
      const { service, loggerService, owner, dseqs, closureHeight } = setup({
        inputs: [
          {
            leases: [{ blockRate: 0 }],
            deployment: {
              createdHeight: 995000,
              funds: 40000,
              transferred: 20000
            }
          }
        ]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(0);
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DEPLOYMENT_BLOCK_RATE_INVALID",
          dseq: Number(dseqs[0]),
          owner
        })
      );
    });

    it("sets closedHeight when lease is closed", async () => {
      const input = {
        leases: [
          {
            blockRate: 50,
            state: "closed" as const,
            closedHeight: 999000
          }
        ],
        deployment: {
          createdHeight: 995000,
          funds: 40000,
          transferred: 20000
        }
      };

      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [input]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(1);
      expect(result[0].closedHeight).toBe(input.leases[0].closedHeight);
    });
  });

  function setup({
    inputs = []
  }: {
    inputs?: Array<{
      leases: Array<{
        blockRate: number;
        gseq?: number;
        state?: string;
        closedHeight?: number;
      }>;
      deployment?: {
        dseq?: string;
        createdHeight?: number;
        funds?: number;
        transferred?: number;
      };
    }>;
  } = {}) {
    const leaseHttpService = mock<LeaseHttpService>();
    const deploymentHttpService = mock<DeploymentHttpService>();
    const loggerService = mock<LoggerService>();

    const owner = createAkashAddress();
    const closureHeight = 1000000;

    const dseqs: string[] = [];
    const leases: ReturnType<typeof LeaseApiResponseSeeder.create>[] = [];
    const deployments: ReturnType<typeof DeploymentListResponseSeeder.create>[] = [];

    inputs.forEach(input => {
      const dseq = input.deployment?.dseq ?? faker.string.numeric({ length: 6, allowLeadingZeros: false });
      dseqs.push(dseq);

      input.leases.forEach((lease, leaseIdx) => {
        leases.push(
          LeaseApiResponseSeeder.create({
            owner,
            dseq,
            gseq: lease.gseq ?? leaseIdx,
            state: lease.state ?? "active",
            closed_on: lease.closedHeight ? String(lease.closedHeight) : undefined,
            price: { denom: "uakt", amount: String(lease.blockRate) }
          })
        );
      });

      if (input.deployment) {
        const createdHeight = input.deployment.createdHeight ?? 995000;
        const funds = input.deployment.funds ?? 40000;
        const transferred = input.deployment.transferred ?? 20000;

        const deployment = DeploymentListResponseSeeder.create(
          {
            owner,
            dseq,
            createdAt: String(createdHeight)
          },
          1
        );
        const deploymentInfo = deployment.deployments[0];
        if ("escrow_account" in deploymentInfo) {
          deploymentInfo.escrow_account.state.funds = [{ denom: "uakt", amount: String(funds) }];
          deploymentInfo.escrow_account.state.transferred = [{ denom: "uakt", amount: String(transferred) }];
        }
        deployments.push(deployment);
      }
    });

    const leaseList = leases;
    const deploymentList = deployments.flatMap(d => d.deployments);

    leaseHttpService.list.mockResolvedValue({
      leases: leaseList,
      pagination: { next_key: null, total: String(leaseList.length) }
    });

    deploymentHttpService.findAll.mockResolvedValue({
      deployments: deploymentList,
      pagination: { next_key: null, total: String(deploymentList.length) }
    } as unknown as DeploymentListResponse);

    const service = new DrainingDeploymentRpcService(leaseHttpService, deploymentHttpService, loggerService);

    return {
      service,
      leaseHttpService,
      deploymentHttpService,
      loggerService,
      owner,
      dseqs,
      closureHeight
    };
  }
});
