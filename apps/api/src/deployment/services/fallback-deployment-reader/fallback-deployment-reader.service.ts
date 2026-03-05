import { Deployment, DeploymentGroup, DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import { inject, singleton } from "tsyringe";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DatabaseDeploymentListParams } from "@src/deployment/repositories/deployment/deployment.repository";
import { RestAkashDeploymentInfoResponse } from "@src/types/rest/akashDeploymentInfoResponse";
import { RestAkashDeploymentListResponse } from "@src/types/rest/akashDeploymentListResponse";

export const UNKNOWN_DB_PLACEHOLDER = "unknown_value";

@singleton()
export class FallbackDeploymentReaderService {
  readonly #coreConfig: CoreConfig;

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    @inject(CORE_CONFIG) coreConfig: CoreConfig
  ) {
    this.#coreConfig = coreConfig;
  }

  async findAll(params: DatabaseDeploymentListParams): Promise<RestAkashDeploymentListResponse> {
    const { skip = 0, limit = 100, key, countTotal = true } = params;

    const { count: total, rows: deployments } = await this.deploymentRepository.findDeploymentsWithPagination(params);

    const transformedDeployments = await Promise.all(
      (deployments || []).map(async deployment => {
        const groups = this.transformDeploymentGroups(deployment);

        return {
          deployment: {
            id: {
              owner: deployment.owner || "",
              dseq: deployment.dseq || ""
            },
            state: deployment.closedHeight ? "closed" : "active",
            hash: UNKNOWN_DB_PLACEHOLDER,
            created_at: (deployment.createdHeight ?? 0).toString()
          },
          groups,
          escrow_account: {
            id: {
              scope: "deployment",
              xid: `${deployment.owner || ""}/${deployment.dseq || ""}`
            },
            state: {
              owner: deployment.owner || "",
              state: deployment.closedHeight ? "closed" : "open",
              transferred: [
                {
                  denom: this.mapDenom(deployment.denom || "uakt"),
                  amount: (deployment.withdrawnAmount ?? 0).toFixed(18)
                }
              ],
              settled_at: (deployment.lastWithdrawHeight ?? deployment.createdHeight ?? 0).toString(),
              funds: [
                {
                  denom: this.mapDenom(deployment.denom || "uakt"),
                  amount: (deployment.balance ?? 0).toFixed(18)
                }
              ],
              deposits: [
                {
                  owner: deployment.owner || "",
                  height: (deployment.createdHeight ?? 0).toString(),
                  source: "balance",
                  balance: {
                    denom: this.mapDenom(deployment.denom || "uakt"),
                    amount: (deployment.balance ?? 0).toFixed(18)
                  }
                }
              ]
            }
          }
        };
      })
    );

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

  async findByOwnerAndDseq(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse | null> {
    const deployment = await this.deploymentRepository.findByIdWithGroups(owner, dseq);

    if (!deployment) {
      return null;
    }

    const groups = this.transformDeploymentGroups(deployment);

    return {
      deployment: {
        id: {
          owner: deployment.owner || "",
          dseq: deployment.dseq || ""
        },
        state: deployment.closedHeight ? "closed" : "active",
        hash: UNKNOWN_DB_PLACEHOLDER,
        created_at: (deployment.createdHeight ?? 0).toString()
      },
      groups,
      escrow_account: {
        id: {
          scope: "deployment",
          xid: `${deployment.owner || ""}/${deployment.dseq || ""}`
        },
        state: {
          owner: deployment.owner || "",
          state: deployment.closedHeight ? "closed" : "open",
          transferred: [
            {
              denom: this.mapDenom(deployment.denom || "uakt"),
              amount: (deployment.withdrawnAmount ?? 0).toFixed(18)
            }
          ],
          settled_at: (deployment.lastWithdrawHeight ?? deployment.createdHeight ?? 0).toString(),
          funds: [
            {
              denom: this.mapDenom(deployment.denom || "uakt"),
              amount: (deployment.balance ?? 0).toFixed(18)
            }
          ],
          deposits: [
            {
              owner: deployment.owner || "",
              height: (deployment.createdHeight ?? 0).toString(),
              source: "balance",
              balance: {
                denom: this.mapDenom(deployment.denom || "uakt"),
                amount: (deployment.balance ?? 0).toFixed(18)
              }
            }
          ]
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
                  attributes: []
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
