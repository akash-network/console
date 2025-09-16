import { Block } from "@akashnetwork/database/dbSchemas";
import { Deployment, Lease, Provider, ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";
import { DeploymentHttpService, DeploymentInfo, LeaseHttpService, RestAkashLeaseListResponse } from "@akashnetwork/http-sdk";
import { PromisePool } from "@supercharge/promise-pool";
import assert from "http-assert";
import { InternalServerError } from "http-errors";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ProviderList } from "@src/types/provider";
import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { averageBlockCountInAMonth } from "@src/utils/constants";
import { MessageService } from "../message-service/message.service";

@singleton()
export class DeploymentReaderService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly messageService: MessageService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  public async findByOwnerAndDseq(owner: string, dseq: string): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.getWalletByAddress(owner);
    const deploymentResponse = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);

    if ("code" in deploymentResponse) {
      assert(!deploymentResponse.message?.toLowerCase().includes("deployment not found"), 404, "Deployment not found");

      throw new InternalServerError(deploymentResponse.message);
    }

    const { leases } = await this.leaseHttpService.list({ owner, dseq });

    const leasesWithStatus = await Promise.all(
      leases.map(async ({ lease }) => {
        try {
          const leaseStatus = await this.providerService.getLeaseStatus(
            lease.lease_id.provider,
            lease.lease_id.dseq,
            lease.lease_id.gseq,
            lease.lease_id.oseq,
            wallet.id
          );
          return {
            lease,
            status: leaseStatus
          };
        } catch {
          return {
            lease,
            status: null
          };
        }
      })
    );

    return {
      deployment: deploymentResponse.deployment,
      leases: leasesWithStatus.map(({ lease, status }) => ({
        ...lease,
        status
      })),
      escrow_account: deploymentResponse.escrow_account
    };
  }

  public async list(
    owner: string,
    { skip, limit }: { skip?: number; limit?: number }
  ): Promise<{ deployments: GetDeploymentResponse["data"][]; total: number; hasMore: boolean }> {
    const pagination = skip !== undefined || limit !== undefined ? { offset: skip, limit } : undefined;
    const deploymentReponse = await this.deploymentHttpService.findAll({ owner, state: "active", pagination });
    const deployments = deploymentReponse.deployments;
    const total = parseInt(deploymentReponse.pagination.total, 10);

    const { results: leasesByDeployment } = await PromisePool.withConcurrency(100)
      .for(deployments)
      .process(async deployment => this.leaseHttpService.list({ owner, dseq: deployment.deployment.deployment_id.dseq }));

    const wallet = await this.getWalletByAddress(owner);
    const leaseStatusesByDeployment = await this.getLeaseStatuses(leasesByDeployment, wallet.id);

    const deploymentsWithLeases = deployments.map((deployment, deploymentIndex) => ({
      deployment: deployment.deployment,
      leases:
        leasesByDeployment[deploymentIndex]?.leases?.map(({ lease }, leaseIndex) => ({
          ...lease,
          status: leaseStatusesByDeployment[deploymentIndex][leaseIndex]
        })) ?? [],
      escrow_account: deployment.escrow_account
    }));

    return {
      deployments: deploymentsWithLeases,
      total,
      hasMore: skip !== undefined && limit !== undefined ? total > skip + limit : false
    };
  }

  private async getLeaseStatuses(leasesByDeployment: RestAkashLeaseListResponse[], walletId: number): Promise<LeaseStatusResponse[][]> {
    const deploymentConcurrency = 10;
    const leaseConcurrency = 10;
    const leaseStatusesByDeployment: LeaseStatusResponse[][] = [];

    await PromisePool.withConcurrency(deploymentConcurrency)
      .for(leasesByDeployment)
      .process(async ({ leases }, deploymentIndex) => {
        await PromisePool.withConcurrency(leaseConcurrency)
          .for(leases)
          .process(async ({ lease }, leaseIndex) => {
            const leaseStatus = await this.providerService.getLeaseStatus(
              lease.lease_id.provider,
              lease.lease_id.dseq,
              lease.lease_id.gseq,
              lease.lease_id.oseq,
              walletId
            );

            if (!leaseStatusesByDeployment[deploymentIndex]) {
              leaseStatusesByDeployment[deploymentIndex] = [];
            }

            leaseStatusesByDeployment[deploymentIndex][leaseIndex] = leaseStatus;
          });
      });

    return leaseStatusesByDeployment;
  }

  public async listWithResources({
    address,
    status,
    skip,
    limit,
    reverseSorting
  }: {
    address: string;
    status?: "active" | "closed";
    skip?: number;
    limit?: number;
    reverseSorting?: boolean;
  }) {
    const response = await this.deploymentHttpService.findAll({
      owner: address,
      state: status,
      pagination: {
        offset: skip,
        limit: limit,
        reverse: reverseSorting,
        countTotal: true
      }
    });
    const leaseResponse = await this.leaseHttpService.list({ owner: address, state: "active" });
    const providers = response.deployments.length ? await this.providerService.getProviderList() : ([] as ProviderList[]);

    return {
      count: parseInt(response.pagination.total),
      results: response.deployments.map(x => ({
        owner: x.deployment.deployment_id.owner,
        dseq: x.deployment.deployment_id.dseq,
        status: x.deployment.state,
        createdHeight: parseInt(x.deployment.created_at),
        escrowAccount: x.escrow_account,
        cpuUnits: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        gpuUnits: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        memoryQuantity: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        storageQuantity: x.groups
          .map(g =>
            g.group_spec.resources
              .map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count)
              .reduce((a, b) => a + b, 0)
          )
          .reduce((a, b) => a + b, 0),
        leases: leaseResponse.leases
          .filter(l => l.lease.lease_id.dseq === x.deployment.deployment_id.dseq)
          .map(lease => {
            const provider = providers.find(p => p.owner === lease.lease.lease_id.provider);
            return {
              id: lease.lease.lease_id.dseq + lease.lease.lease_id.gseq + lease.lease.lease_id.oseq,
              owner: lease.lease.lease_id.owner,
              provider: provider
                ? {
                    ...provider,
                    address: provider.owner
                  }
                : undefined,
              dseq: lease.lease.lease_id.dseq,
              gseq: lease.lease.lease_id.gseq,
              oseq: lease.lease.lease_id.oseq,
              state: lease.lease.state,
              price: lease.lease.price
            };
          })
      }))
    };
  }

  public async getDeploymentByOwnerAndDseq(owner: string, dseq: string) {
    let deploymentData: RestAkashDeploymentInfoResponse | null = null;
    try {
      deploymentData = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);

      if ("code" in deploymentData) {
        if (deploymentData.message?.toLowerCase().includes("deployment not found")) {
          return null;
        } else {
          throw new Error(deploymentData.message);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }

      throw error;
    }

    const leasesQuery = this.leaseHttpService.list({ owner, dseq });
    const relatedMessagesQuery = this.messageService.getDeploymentRelatedMessages(owner, dseq);
    const dbDeploymentQuery = Deployment.findOne({
      attributes: ["createdHeight", "closedHeight"],
      where: { owner: owner, dseq: dseq },
      include: [
        { model: Block, attributes: ["datetime"], as: "createdBlock" },
        { model: Block, attributes: ["datetime"], as: "closedBlock" },
        {
          model: Lease,
          attributes: ["createdHeight", "closedHeight", "gseq", "oseq"],
          include: [
            { model: Block, attributes: ["datetime"], as: "createdBlock" },
            { model: Block, attributes: ["datetime"], as: "closedBlock" }
          ]
        }
      ]
    });

    const [leasesData, relatedMessages, dbDeployment] = await Promise.all([leasesQuery, relatedMessagesQuery, dbDeploymentQuery]);

    const providerAddresses = leasesData.leases.map(x => x.lease.lease_id.provider);
    const providers = await Provider.findAll({
      where: {
        owner: {
          [Op.in]: providerAddresses
        }
      },
      include: [{ model: ProviderAttribute }]
    });
    const deploymentDenom = deploymentData.escrow_account.balance.denom;

    const leases = leasesData.leases.map(x => {
      const provider = providers.find(p => p.owner === x.lease.lease_id.provider);
      const group = (deploymentData as DeploymentInfo).groups.find(g => g.group_id.gseq === x.lease.lease_id.gseq);
      const dbLease = dbDeployment?.leases.find(l => l.gseq === x.lease.lease_id.gseq && l.oseq === x.lease.lease_id.oseq);

      return {
        gseq: x.lease.lease_id.gseq,
        oseq: x.lease.lease_id.oseq,
        createdHeight: dbLease?.createdHeight,
        createdDate: dbLease?.createdBlock?.datetime,
        closedHeight: dbLease?.closedHeight,
        closedDate: dbLease?.closedBlock?.datetime,
        provider: provider
          ? {
              address: provider.owner,
              hostUri: provider.hostUri,
              isDeleted: !!provider.deletedHeight,
              attributes: provider.providerAttributes.map(attr => ({
                key: attr.key,
                value: attr.value
              }))
            }
          : null,
        status: x.lease.state,
        monthlyCostUDenom: Math.round(parseFloat(x.lease.price.amount) * averageBlockCountInAMonth),
        cpuUnits: group?.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0) || 0,
        gpuUnits: group?.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0) || 0,
        memoryQuantity: group?.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0) || 0,
        storageQuantity:
          group?.group_spec.resources
            .map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count)
            .reduce((a, b) => a + b, 0) || 0
      };
    });

    return {
      owner: deploymentData.deployment.deployment_id.owner,
      dseq: deploymentData.deployment.deployment_id.dseq,
      balance: parseFloat(deploymentData.escrow_account.balance.amount),
      denom: deploymentDenom,
      status: deploymentData.deployment.state,
      createdHeight: dbDeployment?.createdHeight,
      createdDate: dbDeployment?.createdBlock?.datetime,
      closedHeight: dbDeployment?.closedHeight,
      closedDate: dbDeployment?.closedBlock?.datetime,
      totalMonthlyCostUDenom: leases.map(x => x.monthlyCostUDenom).reduce((a, b) => a + b, 0),
      leases: leases,
      events: relatedMessages || [],
      other: deploymentData
    };
  }

  private async getWalletByAddress(address: string) {
    const wallet = await this.userWalletRepository.findOneBy({ address });
    if (!wallet) {
      throw new Error(`Wallet not found for address: ${address}`);
    }

    return wallet;
  }
}
