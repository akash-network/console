import { Block } from "@akashnetwork/database/dbSchemas";
import { Deployment, Lease, Provider, ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";
import {
  DeploymentHttpService,
  DeploymentInfo,
  DeploymentListResponse,
  LeaseHttpService,
  LeaseListParams,
  PaginationParams,
  RestAkashLeaseListResponse
} from "@akashnetwork/http-sdk";
import { PromisePool } from "@supercharge/promise-pool";
import { AxiosError } from "axios";
import assert from "http-assert";
import { InternalServerError } from "http-errors";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { WalletInitialized, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ProviderList } from "@src/types/provider";
import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { averageBlockCountInAMonth } from "@src/utils/constants";
import { FallbackDeploymentReaderService } from "../fallback-deployment-reader/fallback-deployment-reader.service";
import { MessageService } from "../message-service/message.service";

@singleton()
export class DeploymentReaderService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly fallbackDeploymentReaderService: FallbackDeploymentReaderService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly fallbackLeaseReaderService: FallbackLeaseReaderService,
    private readonly messageService: MessageService,
    private readonly walletReaderService: WalletReaderService
  ) {}

  public async findByUserIdAndDseq(userId: string, dseq: string): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    return this.findByWalletAndDseq(wallet, dseq);
  }

  public async findByWalletAndDseq(
    wallet: WalletInitialized,
    dseq: string,
    options?: { certificate?: { certPem: string; keyPem: string } }
  ): Promise<GetDeploymentResponse["data"]> {
    const { address: owner } = wallet;
    const deploymentResponse = await this.getDeployment(owner, dseq);
    assert(deploymentResponse, 404, "Deployment not found");

    if ("code" in deploymentResponse) {
      assert(!deploymentResponse.message?.toLowerCase().includes("deployment not found"), 404, "Deployment not found");

      throw new InternalServerError(deploymentResponse.message);
    }

    const { leases } = await this.getLeaseList({ owner, dseq });

    const leasesWithStatus = await Promise.all(
      leases.map(async ({ lease }) => {
        try {
          const leaseStatus = await this.providerService.getLeaseStatus(
            lease.lease_id.provider,
            lease.lease_id.dseq,
            lease.lease_id.gseq,
            lease.lease_id.oseq,
            await this.providerService.toProviderAuth(options?.certificate || { walletId: wallet.id, provider: lease.lease_id.provider })
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

  public async list({
    query,
    skip,
    limit
  }: {
    query: { userId: string };
    skip?: number;
    limit?: number;
  }): Promise<{ deployments: GetDeploymentResponse["data"][]; total: number; hasMore: boolean }> {
    const { address: owner } = await this.walletReaderService.getWalletByUserId(query.userId);
    const pagination = skip !== undefined || limit !== undefined ? { offset: skip, limit } : undefined;
    const deploymentReponse = await this.getDeploymentsList({ owner, state: "active", pagination });
    const deployments = deploymentReponse.deployments;
    const total = parseInt(deploymentReponse.pagination.total, 10);

    const { results: leaseResults } = await PromisePool.withConcurrency(100)
      .for(deployments)
      .process(async deployment => this.leaseHttpService.list({ owner, dseq: deployment.deployment.id.dseq }));

    const deploymentsWithLeases = deployments.map((deployment, index) => ({
      deployment: deployment.deployment,
      leases:
        leaseResults[index]?.leases?.map(({ lease }) => ({
          ...lease,
          status: null as null
        })) ?? [],
      escrow_account: deployment.escrow_account
    }));
    return {
      deployments: deploymentsWithLeases,
      total,
      hasMore: skip !== undefined && limit !== undefined ? total > skip + limit : false
    };
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
    const response = await this.getDeploymentsList({
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
        owner: x.deployment.id.owner,
        dseq: x.deployment.id.dseq,
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
          .filter(l => l.lease.lease_id.dseq === x.deployment.id.dseq)
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
      deploymentData = await this.getDeployment(owner, dseq);
      assert(deploymentData, 404, "Deployment not found");

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
    const deploymentDenom = deploymentData.escrow_account.state.funds[0]?.denom || deploymentData.escrow_account.state.transferred[0]?.denom;

    const leases = leasesData.leases.map(x => {
      const provider = providers.find(p => p.owner === x.lease.lease_id.provider);
      const group = (deploymentData as DeploymentInfo).groups.find(g => g.id.gseq === x.lease.lease_id.gseq);
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
      owner: deploymentData.deployment.id.owner,
      dseq: deploymentData.deployment.id.dseq,
      balance: parseFloat(deploymentData.escrow_account.state.funds[0]?.amount || "0"),
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

  private async getDeployment(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse | null> {
    try {
      return await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);
    } catch (error) {
      if (this.shouldFallbackToDatabase(error)) {
        return await this.fallbackDeploymentReaderService.findByOwnerAndDseq(owner, dseq);
      }

      throw error;
    }
  }

  private async getDeploymentsList(params: { owner: string; state?: "active" | "closed"; pagination?: PaginationParams }): Promise<DeploymentListResponse> {
    try {
      return await this.deploymentHttpService.findAll(params);
    } catch (error) {
      if (this.shouldFallbackToDatabase(error)) {
        return await this.fallbackDeploymentReaderService.findAll(params);
      }

      throw error;
    }
  }

  private async getLeaseList(params: LeaseListParams): Promise<RestAkashLeaseListResponse> {
    try {
      return await this.leaseHttpService.list(params);
    } catch (error) {
      if (this.shouldFallbackToDatabase(error)) {
        return await this.fallbackLeaseReaderService.list(params);
      }

      throw error;
    }
  }

  /**
   * Determines if an error should trigger fallback to database services.
   * Falls back for network/connectivity issues but not for business logic errors.
   */
  private shouldFallbackToDatabase(error: unknown): boolean {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
        return true;
      }

      if (error.response?.status && error.response?.status >= 500) {
        return true;
      }
    }

    if (error instanceof Error) {
      if (error.message?.toLowerCase().includes("timeout")) {
        return true;
      }

      if (
        error.message?.toLowerCase().includes("connection") &&
        (error.message.toLowerCase().includes("refused") || error.message.toLowerCase().includes("reset"))
      ) {
        return true;
      }
    }

    return false;
  }
}
