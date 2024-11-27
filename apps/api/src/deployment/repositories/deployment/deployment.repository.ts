import { Deployment, Lease } from "@akashnetwork/database/dbSchemas/akash";
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

export interface StaleDeploymentsOutput {
  dseq: number;
}

@singleton()
export class DeploymentRepository {
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
            provider: options.provider
          }
        }
      ],
      raw: true
    });

    return deployments ? (deployments as unknown as StaleDeploymentsOutput[]) : [];
  }
}
