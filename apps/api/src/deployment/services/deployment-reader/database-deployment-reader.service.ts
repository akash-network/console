import { Deployment, DeploymentGroup, DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { RestAkashDeploymentListResponse } from "@src/types/rest/akashDeploymentListResponse";

export interface DatabaseDeploymentListParams {
  owner?: string;
  state?: "active" | "closed";
  skip?: number;
  limit?: number;
  key?: string;
  countTotal?: boolean;
  reverse?: boolean;
}

// For the values that are not stored in the database
export const FALLBACK_VALUE = "FALLBACK";

@singleton()
export class DatabaseDeploymentReaderService {
  async listDeployments(params: DatabaseDeploymentListParams): Promise<RestAkashDeploymentListResponse> {
    const { owner, state, skip = 0, limit = 100, key, countTotal = true, reverse = false } = params;

    const whereClause: Record<string, unknown> = {};
    if (owner) {
      whereClause.owner = owner;
    }
    if (state === "active") {
      whereClause.closedHeight = null;
    } else if (state === "closed") {
      whereClause.closedHeight = { [Op.ne]: null };
    }

    // Handle pagination similar to HTTP service
    // If key is provided, use it as offset (simplified key-based pagination)
    const offset = key ? parseInt(key, 10) || 0 : skip;

    const queryOptions: Record<string, unknown> = {
      where: whereClause,
      include: [
        {
          model: DeploymentGroup,
          include: [
            {
              model: DeploymentGroupResource,
              separate: true
            }
          ]
        }
      ],
      offset,
      limit,
      order: [["createdHeight", reverse ? "DESC" : "ASC"]]
    };

    // Only count total if countTotal is true or if offset is used (matching HTTP service behavior)
    const shouldCountTotal = countTotal || offset !== undefined;

    const { count: total, rows: deployments } = await Deployment.findAndCountAll(queryOptions);

    const transformedDeployments = await Promise.all(
      (deployments || []).map(async deployment => {
        const groups =
          deployment.deploymentGroups?.map(group => ({
            group_id: {
              owner: group.owner || "",
              dseq: group.dseq || "",
              gseq: group.gseq || 0
            },
            state: deployment.closedHeight ? "closed" : "open",
            group_spec: {
              name: FALLBACK_VALUE,
              requirements: {
                signed_by: {
                  all_of: [],
                  any_of: []
                },
                attributes: []
              },
              resources:
                group.deploymentGroupResources?.map((resource, i) => {
                  return {
                    resource: {
                      id: i + 1,
                      cpu: {
                        units: {
                          val: (resource.cpuUnits || 0).toString()
                        },
                        attributes: []
                      },
                      memory: {
                        quantity: {
                          val: (resource.memoryQuantity || 0).toString()
                        },
                        attributes: []
                      },
                      storage: [
                        {
                          name: "default",
                          quantity: {
                            val: (resource.ephemeralStorageQuantity + resource.persistentStorageQuantity || 0).toString()
                          },
                          attributes: []
                        }
                      ],
                      gpu: {
                        units: {
                          val: (resource.gpuUnits || 0).toString()
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
                      denom: deployment.denom || "uakt",
                      amount: (resource.price || 0).toFixed(18)
                    }
                  };
                }) || []
            },
            created_at: (deployment.createdHeight || 0).toString()
          })) || [];

        return {
          deployment: {
            deployment_id: {
              owner: deployment.owner || "",
              dseq: deployment.dseq || ""
            },
            state: deployment.closedHeight ? "closed" : "active",
            version: FALLBACK_VALUE,
            created_at: (deployment.createdHeight || 0).toString()
          },
          groups,
          escrow_account: {
            id: {
              scope: "deployment",
              xid: `${deployment.owner || ""}/${deployment.dseq || ""}`
            },
            owner: deployment.owner || "",
            state: deployment.closedHeight ? "closed" : "open",
            balance: {
              denom: deployment.denom || "uakt",
              amount: (deployment.balance || 0).toFixed(18)
            },
            transferred: {
              denom: deployment.denom || "uakt",
              amount: (deployment.withdrawnAmount || 0).toFixed(18)
            },
            settled_at: (deployment.lastWithdrawHeight || deployment.createdHeight || 0).toString(),
            depositor: deployment.owner || "",
            funds: {
              denom: deployment.denom || "uakt",
              amount: "0.000000000000000000"
            }
          }
        };
      })
    );

    // Calculate next_key similar to HTTP service
    const hasMore = offset + limit < total;
    const nextKey = hasMore ? (offset + limit).toString() : null;

    return {
      deployments: transformedDeployments,
      pagination: {
        next_key: nextKey,
        total: shouldCountTotal ? total.toString() : "0"
      }
    };
  }
}
