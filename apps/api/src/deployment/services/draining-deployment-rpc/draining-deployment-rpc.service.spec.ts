import type { DeploymentHttpService, DeploymentListResponse, LeaseHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { DrainingDeploymentRpcService } from "./draining-deployment-rpc.service";

import { createAkashAddress } from "@test/seeders";
import { createDeploymentListResponseSeed } from "@test/seeders/deployment-list-response.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

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

    it("excludes deployments when deployment is missing (DEPLOYMENT_NOT_FOUND)", async () => {
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

    it("sets closedHeight when lease has closed_on set", async () => {
      const input = {
        leases: [
          {
            blockRate: 50,
            state: "active" as const,
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DrainingDeploymentRpcService.name });
  });

  describe("when the escrow account is no longer open", () => {
    it.each(["closed", "overdrawn"])("flags a %s escrow account so its setting can be marked closed", async escrowState => {
      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [{ leases: [{ blockRate: 10 }], deployment: { escrowState, funds: 0, transferred: 0 } }]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toEqual([expect.objectContaining({ dseq: Number(dseqs[0]), isClosed: true })]);
    });

    it("keeps an open escrow account unflagged", async () => {
      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [{ leases: [{ blockRate: 100 }], deployment: { escrowState: "open" } }]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toEqual([expect.objectContaining({ dseq: Number(dseqs[0]) })]);
      expect(result[0]).not.toHaveProperty("isClosed");
    });

    it("flags a closed deployment that never held a lease, which nothing keyed on leases could see", async () => {
      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [{ leases: [], deployment: { escrowState: "closed", funds: 0, transferred: 0 } }]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toEqual([expect.objectContaining({ dseq: Number(dseqs[0]), isClosed: true })]);
    });

    it("leaves out an open deployment with no lease yet, which is still waiting on a bid rather than closed", async () => {
      const { service, owner, dseqs, closureHeight, loggerService } = setup({
        inputs: [{ leases: [], deployment: { escrowState: "open" } }]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toEqual([]);
      expect(loggerService.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_BLOCK_RATE_INVALID" }));
    });

    it("flags a lease-less closed deployment alongside an owner's still-running one", async () => {
      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [
          { leases: [], deployment: { dseq: "500001", escrowState: "closed", funds: 0, transferred: 0 } },
          { leases: [{ blockRate: 100 }], deployment: { dseq: "500002", escrowState: "open" } }
        ]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toContainEqual(expect.objectContaining({ dseq: 500001, isClosed: true }));
      expect(result).toContainEqual(expect.objectContaining({ dseq: 500002 }));
    });

    it("does not flag a closed deployment twice when it also has a closed lease", async () => {
      const { service, owner, dseqs, closureHeight } = setup({
        inputs: [{ leases: [{ blockRate: 10, closedHeight: 999999 }], deployment: { escrowState: "closed", funds: 0, transferred: 0 } }]
      });

      const result = await service.findManyByDseqAndOwner(closureHeight, owner, dseqs);

      expect(result).toHaveLength(1);
    });

    it("keeps a flagged deployment that an open lease would place beyond the closure window", async () => {
      const { service, owner, dseqs } = setup({
        inputs: [{ leases: [{ blockRate: 1 }], deployment: { escrowState: "closed", funds: 10_000_000, transferred: 0 } }]
      });

      const result = await service.findManyByDseqAndOwner(1, owner, dseqs);

      expect(result).toEqual([expect.objectContaining({ dseq: Number(dseqs[0]), isClosed: true })]);
    });
  });

  describe("findActiveLeaseRates", () => {
    it("sums the rate of every live lease of a deployment, asking the chain for active ones only", async () => {
      const { service, leaseHttpService, owner, dseqs } = setup({
        inputs: [
          {
            leases: [
              { blockRate: 50, gseq: 1 },
              { blockRate: 25, gseq: 2 }
            ]
          }
        ]
      });

      const result = await service.findActiveLeaseRates(owner, dseqs);

      expect(leaseHttpService.list).toHaveBeenCalledWith(expect.objectContaining({ owner, state: "active" }));
      expect(result).toEqual([{ dseq: dseqs[0], blockRate: 75 }]);
    });

    it("omits deployments the caller did not ask about", async () => {
      const { service, owner, dseqs } = setup({
        inputs: [{ leases: [{ blockRate: 50 }] }, { leases: [{ blockRate: 30 }] }]
      });

      const result = await service.findActiveLeaseRates(owner, [dseqs[0]]);

      expect(result).toEqual([{ dseq: dseqs[0], blockRate: 50 }]);
    });

    it("collects leases across every page", async () => {
      const { service, leaseHttpService, owner, dseqs, leaseList } = setup({
        inputs: [
          {
            leases: [
              { blockRate: 50, gseq: 1 },
              { blockRate: 25, gseq: 2 }
            ]
          }
        ]
      });
      leaseHttpService.list
        .mockResolvedValueOnce({ leases: [leaseList[0]], pagination: { next_key: "page-2", total: "2" } })
        .mockResolvedValueOnce({ leases: [leaseList[1]], pagination: { next_key: null, total: "2" } });

      const result = await service.findActiveLeaseRates(owner, dseqs);

      expect(leaseHttpService.list).toHaveBeenCalledTimes(2);
      expect(leaseHttpService.list).toHaveBeenLastCalledWith(expect.objectContaining({ pagination: { limit: 1000, key: "page-2" } }));
      expect(result).toEqual([{ dseq: dseqs[0], blockRate: 75 }]);
    });

    it("omits a lease with a non-positive rate", async () => {
      const { service, loggerService, owner, dseqs } = setup({
        inputs: [{ leases: [{ blockRate: 0 }] }]
      });

      const result = await service.findActiveLeaseRates(owner, dseqs);

      expect(result).toEqual([]);
      expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ACTIVE_LEASE_RATE_INVALID", dseq: dseqs[0], owner }));
    });

    it("queries nothing when no deployment is given", async () => {
      const { service, leaseHttpService, owner } = setup();

      const result = await service.findActiveLeaseRates(owner, []);

      expect(result).toEqual([]);
      expect(leaseHttpService.list).not.toHaveBeenCalled();
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
        escrowState?: string;
      };
    }>;
  } = {}) {
    const leaseHttpService = mock<LeaseHttpService>();
    const deploymentHttpService = mock<DeploymentHttpService>();
    const loggerService = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => loggerService);

    const owner = createAkashAddress();
    const closureHeight = 1000000;

    const dseqs: string[] = [];
    const deployments: ReturnType<typeof createDeploymentListResponseSeed>[] = [];
    const leases: ReturnType<typeof createLeaseApiResponse>[] = [];

    inputs.forEach(input => {
      const dseq = input.deployment?.dseq ?? faker.string.numeric({ length: 6, allowLeadingZeros: false });
      dseqs.push(dseq);

      input.leases.forEach((lease, leaseIdx) => {
        leases.push(
          createLeaseApiResponse({
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

        const deployment = createDeploymentListResponseSeed(
          {
            owner,
            dseq,
            createdAt: String(createdHeight),
            state: "active"
          },
          1
        );
        const deploymentInfo = deployment.deployments[0];
        if ("escrow_account" in deploymentInfo) {
          deploymentInfo.escrow_account.state.funds = [{ denom: "uakt", amount: String(funds) }];
          deploymentInfo.escrow_account.state.transferred = [{ denom: "uakt", amount: String(transferred) }];
          deploymentInfo.escrow_account.state.state = input.deployment.escrowState ?? "open";
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

    const service = new DrainingDeploymentRpcService(leaseHttpService, deploymentHttpService, createLogger);

    return {
      service,
      leaseHttpService,
      deploymentHttpService,
      loggerService,
      createLogger,
      owner,
      dseqs,
      leaseList,
      closureHeight
    };
  }
});
