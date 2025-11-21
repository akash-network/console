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

  async findAllWithGpuResources(minHeight: number) {
    return await Deployment.findAll({
      attributes: ["id", "owner"],
      where: { createdHeight: { [Op.gte]: minHeight } },
      include: [
        {
          attributes: [],
          model: DeploymentGroup,
          required: true,
          include: [
            {
              attributes: [],
              model: DeploymentGroupResource,
              required: true,
              where: { gpuUnits: 1 }
            }
          ]
        },
        {
          attributes: ["height", "data", "type"],
          model: AkashMessage,
          as: "relatedMessages",
          where: {
            type: {
              [Op.or]: ["/akash.market.v1beta4.MsgCreateBid", "/akash.market.v1beta5.MsgCreateBid"]
            },
            height: { [Op.gte]: minHeight }
          },
          include: [
            { model: Block, attributes: ["height", "dayId", "datetime"], required: true },
            { model: Transaction, attributes: ["hash"], required: true }
          ]
        }
      ]
    });
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
