import { Block } from "@akashnetwork/database/dbSchemas";
import { Deployment, Lease } from "@akashnetwork/database/dbSchemas/akash";
import type { WhereOptions } from "sequelize";
import { QueryTypes } from "sequelize";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { ProviderDeploymentsQuery } from "@src/provider/http-schemas/provider-deployments.schema";

@singleton()
export class ProviderDeploymentsService {
  async getProviderDeploymentsCount(provider: string, status?: ProviderDeploymentsQuery["status"]) {
    const leaseFilter: WhereOptions<Lease> = { providerAddress: provider };
    if (status) {
      leaseFilter.closedHeight = { [status === "active" ? Op.is : Op.ne]: null };
    }

    const result = await Deployment.count({
      include: [{ model: Lease, attributes: [], required: true, where: leaseFilter }]
    });

    return result;
  }

  async getProviderDeployments(provider: string, skip: number, limit: number, status?: ProviderDeploymentsQuery["status"]) {
    let statusCondition = "";
    if (status === "active") {
      statusCondition = `AND l."closedHeight" IS NULL`;
    } else if (status === "closed") {
      statusCondition = `AND l."closedHeight" IS NOT NULL`;
    }

    const deploymentDseqs = await Deployment.sequelize!.query<{ dseq: string }>(
      `/* provider-deployments:paginated-dseqs */ SELECT d."dseq"
       FROM "deployment" d
       INNER JOIN "lease" l ON l."deploymentId" = d."id"
         AND l."providerAddress" = $1
         ${statusCondition}
       GROUP BY d."id"
       ORDER BY d."createdHeight" DESC, d."dseq" DESC
       LIMIT $2 OFFSET $3`,
      {
        bind: [provider, limit, skip],
        type: QueryTypes.SELECT
      }
    );

    const deployments = await Deployment.findAll({
      where: {
        dseq: { [Op.in]: deploymentDseqs.map(d => d.dseq) }
      },
      include: [
        {
          model: Lease,
          required: true,
          where: { providerAddress: provider },
          include: [
            { model: Block, required: true, as: "createdBlock" },
            { model: Block, required: false, as: "closedBlock" }
          ]
        },
        { model: Block, required: true, as: "createdBlock" },
        { model: Block, required: false, as: "closedBlock" }
      ],
      order: [
        ["createdHeight", "DESC"],
        ["dseq", "DESC"]
      ]
    });

    return deployments.map(d => ({
      owner: d.owner,
      dseq: d.dseq,
      denom: d.denom,
      createdHeight: d.createdHeight,
      createdDate: d.createdBlock.datetime,
      closedHeight: d.closedHeight || null,
      closedDate: d.closedHeight && d.closedBlock ? d.closedBlock.datetime : null,
      status: d.closedHeight ? "closed" : "active",
      balance: d.balance,
      transferred: d.withdrawnAmount,
      settledAt: d.lastWithdrawHeight || null,
      resources: d.leases.reduce(
        (acc, l) => ({
          cpu: acc.cpu + l.cpuUnits,
          memory: acc.memory + l.memoryQuantity,
          gpu: acc.gpu + l.gpuUnits,
          ephemeralStorage: acc.ephemeralStorage + l.ephemeralStorageQuantity,
          persistentStorage: acc.persistentStorage + l.persistentStorageQuantity
        }),
        { cpu: 0, memory: 0, gpu: 0, ephemeralStorage: 0, persistentStorage: 0 }
      ),
      leases: d.leases.map(l => ({
        provider: l.providerAddress,
        gseq: l.gseq,
        oseq: l.oseq,
        price: l.price,
        createdHeight: l.createdHeight,
        createdDate: l.createdBlock.datetime,
        closedHeight: l.closedHeight || null,
        closedDate: l.closedHeight && l.closedBlock ? l.closedBlock.datetime : null,
        status: l.closedHeight ? "closed" : "active",
        resources: {
          cpu: l.cpuUnits,
          memory: l.memoryQuantity,
          gpu: l.gpuUnits,
          ephemeralStorage: l.ephemeralStorageQuantity,
          persistentStorage: l.persistentStorageQuantity
        }
      }))
    }));
  }
}
