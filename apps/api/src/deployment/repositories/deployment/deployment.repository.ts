import { Block } from "@akashnetwork/database/dbSchemas";
import { AkashMessage, Deployment, DeploymentGroup, DeploymentGroupResource, Lease } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { literal, Op } from "sequelize";
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

  async countByOwner(owner: string): Promise<number> {
    return await Deployment.count({
      where: { owner }
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

  async findDeploymentsBeforeCutoff(options: DeploymentsBeforeCutoffOptions): Promise<StaleDeploymentsOutput[]> {
    const deployments = await Deployment.findAll({
      attributes: ["dseq"],
      where: {
        owner: options.owner,
        createdHeight: {
          [Op.lt]: options.cutoffHeight
        },
        closedHeight: null
      },
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
          attributes: ["height", "data"],
          model: AkashMessage,
          as: "relatedMessages",
          where: {
            type: "/akash.market.v1beta4.MsgCreateBid",
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
}
