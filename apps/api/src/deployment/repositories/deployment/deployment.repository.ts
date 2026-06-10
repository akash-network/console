import { Block } from "@akashnetwork/database/dbSchemas";
import { AkashMessage, Deployment, DeploymentGroup, DeploymentGroupResource, Lease } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { FindAndCountOptions, FindOptions, literal, Op, WhereOptions } from "sequelize";
import { singleton } from "tsyringe";

export interface StaleDeploymentsOptions {
  createdHeight: number;
  owner: string;
}

export interface ProviderCleanupOptions {
  owner: string;
  provider: string;
}

export interface DeploymentsBeforeCutoffOptions {
  owner: string;
  cutoffHeight: number;
}

export interface DatabaseDeploymentListParams {
  owner?: string;
  state?: "active" | "closed";
  skip?: number;
  limit?: number;
  key?: string;
  countTotal?: boolean;
  reverse?: boolean;
}

export interface StaleDeploymentsOutput {
  dseq: number;
}

@singleton()
export class DeploymentRepository {
  async findByOwnerAndDseq(owner: string, dseq: string): Promise<Deployment | null> {
    return await Deployment.findOne({
      where: { owner, dseq }
    });
  }

  async countActiveByOwner(owner: string, startDate?: string, endDate?: string): Promise<number> {
    return await Deployment.count({
      where: {
        owner,
        closedHeight: null,
        ...(startDate && { "$createdBlock.datetime$": { [Op.gte]: startDate } }),
        ...(endDate && { "$closedBlock.datetime$": { [Op.lte]: endDate } })
      },
      include: [
        { model: Block, as: "createdBlock" },
        { model: Block, as: "closedBlock" }
      ]
    });
  }

  async findStaleDeployments(options: StaleDeploymentsOptions): Promise<StaleDeploymentsOutput[]> {
    const deployments = await Deployment.findAll({
      attributes: ["dseq"],
      include: [
        {
          model: Lease,
          attributes: [],
          required: false
        }
      ],
      where: {
        owner: options.owner,
        createdHeight: {
          [Op.lt]: options.createdHeight
        },
        closedHeight: null
      },
      group: ["deployment.dseq"],
      having: literal(`COUNT("leases"."deploymentId") = 0`),
      raw: true
    });

    return deployments ? (deployments as unknown as StaleDeploymentsOutput[]) : [];
  }

  async findDeploymentsForProvider(options: ProviderCleanupOptions): Promise<StaleDeploymentsOutput[]> {
    const deployments = await Deployment.findAll({
      attributes: ["dseq"],
      where: {
        owner: options.owner,
        closedHeight: null
      },
      include: [
        {
          model: Lease,
          attributes: [],
          required: true,
          where: {
            providerAddress: options.provider
          }
        }
      ],
      raw: true
    });

    return deployments ? (deployments as unknown as StaleDeploymentsOutput[]) : [];
  }

  async *findAllWithGpuResources(options: { minHeight: number; chunkSize?: number }) {
    const BID_TYPES = ["/akash.market.v1beta4.MsgCreateBid", "/akash.market.v1beta5.MsgCreateBid"];
    const chunkSize = options.chunkSize ?? 1000;
    // A non-positive chunkSize would make `batch.length < chunkSize` never break on an empty
    // result and then dereference batch[-1] for the cursor. chunkSize is internal/test-only, so
    // treat a bad value as a programmer error.
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("findAllWithGpuResources: chunkSize must be a positive integer");
    }
    // Keyset cursor over (createdHeight, id) — the leading columns of the existing
    // `deployment_created_height_closed_height` index, so each chunk is an index scan
    // (no full `deployment` seq scan) and we never prefetch the whole ID list.
    let cursor: { createdHeight: number; id: string } | undefined;

    while (true) {
      const batch = await Deployment.findAll({
        attributes: ["id", "owner", "createdHeight"],
        where: {
          [Op.and]: [
            { createdHeight: { [Op.gte]: options.minHeight } },
            ...(cursor
              ? [
                  {
                    [Op.or]: [{ createdHeight: { [Op.gt]: cursor.createdHeight } }, { createdHeight: cursor.createdHeight, id: { [Op.gt]: cursor.id } }]
                  }
                ]
              : []),
            // Express the single-GPU membership as a non-fanning EXISTS instead of an
            // INNER JOIN: a deployment with >1 matching resource must still be yielded once.
            // Correlates on the main query's "deployment" alias (lowercase, matching the SQL
            // Sequelize emits for this model).
            literal(`EXISTS (
              SELECT 1
              FROM "deploymentGroup" dg
              JOIN "deploymentGroupResource" dgr ON dgr."deploymentGroupId" = dg."id"
              WHERE dg."deploymentId" = "deployment"."id" AND dgr."gpuUnits" = 1
            )`)
          ]
        },
        include: [
          {
            model: AkashMessage,
            as: "relatedMessages",
            // Load bids in a dedicated query keyed on the indexed relatedDeploymentId instead of
            // joining inline. This keeps the main query a pure indexed deployment scan, so LIMIT
            // counts deployments and the keyset cursor stays exact. Joining inline would make
            // LIMIT count joined message rows and a non-bid deployment in the window could shorten
            // a chunk and end paging early.
            separate: true,
            attributes: ["height", "data", "type"],
            where: {
              type: { [Op.in]: BID_TYPES },
              height: { [Op.gte]: options.minHeight }
            },
            include: [
              { model: Block, attributes: ["height", "dayId", "datetime"], required: true },
              { model: Transaction, attributes: ["hash"], required: true }
            ]
          }
        ],
        order: [
          ["createdHeight", "ASC"],
          ["id", "ASC"]
        ] as [string, "ASC" | "DESC"][],
        limit: chunkSize
      });

      for (const deployment of batch) {
        yield deployment;
      }

      if (batch.length < chunkSize) break;
      const last = batch[batch.length - 1];
      cursor = { createdHeight: last.createdHeight, id: last.id };
    }
  }

  async findByIdWithGroups(owner: string, dseq: string): Promise<Deployment | null> {
    return await Deployment.findOne({
      where: { owner, dseq },
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
      ]
    });
  }

  async findDeploymentsWithPagination(params: DatabaseDeploymentListParams): Promise<{ count: number; rows: Deployment[] }> {
    const { owner, state, skip = 0, limit = 100, key, countTotal = true, reverse = false } = params;

    const whereClause: WhereOptions = {};
    if (owner) {
      whereClause.owner = owner;
    }
    if (state === "active") {
      whereClause.closedHeight = null;
    } else if (state === "closed") {
      whereClause.closedHeight = { [Op.ne]: null };
    }

    const offset = key ? parseInt(key, 10) || 0 : skip;

    const queryOptions: FindAndCountOptions = {
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
      order: [["createdHeight", reverse ? "DESC" : "ASC"]] as [string, "ASC" | "DESC"][],
      distinct: true
    };

    if (countTotal) {
      return await Deployment.findAndCountAll(queryOptions);
    } else {
      const rows = await Deployment.findAll(queryOptions as FindOptions);
      return { count: 0, rows };
    }
  }
}
