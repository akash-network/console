import { Deployment, DeploymentGroup, DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import type { DeploymentInfo } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import { cacheResponse, Memoize } from "@src/caching/helpers";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { type ClosedDeploymentPageQuery, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DatabaseDeploymentListParams } from "@src/deployment/repositories/deployment/deployment.repository";
import { RestAkashDeploymentInfoResponse } from "@src/types/rest/akashDeploymentInfoResponse";
import { RestAkashDeploymentListResponse } from "@src/types/rest/akashDeploymentListResponse";
import { averageBlockTime } from "@src/utils/constants";

export const UNKNOWN_DB_PLACEHOLDER = "unknown_value";

@singleton()
export class FallbackDeploymentReaderService {
  readonly #coreConfig: CoreConfig;

  readonly #listCache = new MemoryCacheEngine({ maxEntries: 500, name: "FallbackDeploymentReaderService#findAll" });

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    @inject(CORE_CONFIG) coreConfig: CoreConfig
  ) {
    this.#coreConfig = coreConfig;
  }

  async findAll(params: DatabaseDeploymentListParams): Promise<RestAkashDeploymentListResponse> {
    return cacheResponse(
      averageBlockTime,
      `FallbackDeploymentReaderService#findAll#${JSON.stringify(params)}`,
      () => this.findAllUncached(params),
      this.#listCache
    );
  }

  private async findAllUncached(params: DatabaseDeploymentListParams): Promise<RestAkashDeploymentListResponse> {
    const { skip = 0, limit = 100, key, countTotal = true } = params;

    const { count: total, rows: deployments } = await this.deploymentRepository.findDeploymentsWithPagination(params);

    const transformedDeployments = deployments.map(deployment => this.#toDeploymentInfo(deployment));

    // Calculate next_key similar to HTTP service
    const offset = key ? parseInt(key, 10) || 0 : skip;
    const hasMore = offset + limit < total;
    const nextKey = hasMore ? (offset + limit).toString() : null;

    return {
      deployments: transformedDeployments,
      pagination: {
        next_key: nextKey,
        total: countTotal ? total.toString() : "0"
      }
    };
  }

  @Memoize({ ttlInSeconds: averageBlockTime, maxEntries: 500 })
  async findByOwnerAndDseq(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse | null> {
    const deployment = await this.deploymentRepository.findByIdWithGroups(owner, dseq);

    return deployment ? this.#toDeploymentInfo(deployment) : null;
  }

  async findClosedPage(query: ClosedDeploymentPageQuery): Promise<{ deployments: DeploymentInfo[]; total: number }> {
    const { deployments, total } = await this.deploymentRepository.findClosedPage(query);

    return { deployments: deployments.map(deployment => this.#toDeploymentInfo(deployment)), total };
  }

  #toDeploymentInfo(deployment: Deployment): DeploymentInfo {
    const owner = deployment.owner || "";
    const dseq = deployment.dseq || "";
    const denom = this.mapDenom(deployment.denom || "uakt");
    const createdHeight = (deployment.createdHeight ?? 0).toString();
    const balance = { denom, amount: (deployment.balance ?? 0).toFixed(18) };

    return {
      deployment: {
        id: { owner, dseq },
        state: deployment.closedHeight ? "closed" : "active",
        hash: UNKNOWN_DB_PLACEHOLDER,
        created_at: createdHeight
      },
      groups: this.transformDeploymentGroups(deployment),
      escrow_account: {
        id: {
          scope: "deployment",
          xid: `${owner}/${dseq}`
        },
        state: {
          owner,
          state: deployment.closedHeight ? "closed" : "open",
          transferred: [{ denom, amount: (deployment.withdrawnAmount ?? 0).toFixed(18) }],
          settled_at: (deployment.lastWithdrawHeight ?? deployment.createdHeight ?? 0).toString(),
          funds: [balance],
          deposits: [{ owner, height: createdHeight, source: "balance", balance }]
        }
      }
    };
  }

  private transformDeploymentGroups(deployment: Deployment) {
    return (
      deployment.deploymentGroups?.map((group: DeploymentGroup) => ({
        id: {
          owner: group.owner || "",
          dseq: group.dseq || "",
          gseq: group.gseq || 0
        },
        state: deployment.closedHeight ? "closed" : "open",
        group_spec: {
          name: UNKNOWN_DB_PLACEHOLDER,
          requirements: {
            signed_by: {
              all_of: [],
              any_of: []
            },
            attributes: []
          },
          resources:
            group.deploymentGroupResources?.map((resource: DeploymentGroupResource, i: number) => ({
              resource: {
                id: i + 1,
                cpu: {
                  units: {
                    val: (resource.cpuUnits ?? 0).toString()
                  },
                  attributes: []
                },
                memory: {
                  quantity: {
                    val: (resource.memoryQuantity ?? 0).toString()
                  },
                  attributes: []
                },
                storage: [
                  {
                    name: "default",
                    quantity: {
                      val: ((resource.ephemeralStorageQuantity ?? 0) + (resource.persistentStorageQuantity ?? 0)).toString()
                    },
                    attributes: []
                  }
                ],
                gpu: {
                  units: {
                    val: (resource.gpuUnits ?? 0).toString()
                  },
                  attributes: gpuAttributesOf(resource)
                },
                endpoints: [
                  {
                    kind: "SHARED_HTTP",
                    sequence_number: 0
                  }
                ]
              },
              count: resource.count || 1,
              price: {
                denom: this.mapDenom(deployment.denom || "uakt"),
                amount: (resource.price ?? 0).toFixed(18)
              }
            })) || []
        },
        created_at: (deployment.createdHeight ?? 0).toString()
      })) || []
    );
  }

  private mapDenom(denom: string): string {
    if (denom === "uusdc") {
      const network = this.#coreConfig.NETWORK;
      if (network === "mainnet") {
        return USDC_IBC_DENOMS.mainnetId;
      } else if (network === "sandbox") {
        return USDC_IBC_DENOMS.sandboxId;
      }
      return USDC_IBC_DENOMS.mainnetId;
    }
    return denom;
  }
}

/** The indexer keeps a gpu's vendor and model only when the chain named exactly one, storing a wildcard model as null, so this is the attribute the chain held. */
function gpuAttributesOf({ gpuVendor, gpuModel }: DeploymentGroupResource): { key: string; value: string }[] {
  return gpuVendor ? [{ key: `vendor/${gpuVendor}/model/${gpuModel ?? "*"}`, value: "true" }] : [];
}
