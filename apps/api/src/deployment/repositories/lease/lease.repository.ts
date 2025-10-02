import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { col, fn, Op, WhereOptions } from "sequelize";
import { singleton } from "tsyringe";

export interface DrainingDeploymentOutput {
  dseq: number;
  owner: string;
  denom: string;
  blockRate: number;
  predictedClosedHeight: number;
  closedHeight?: number;
}

export interface DatabaseLeaseListParams {
  owner?: string;
  dseq?: string;
  gseq?: number;
  oseq?: number;
  provider?: string;
  state?: string;
  skip?: number;
  limit?: number;
  key?: string;
  countTotal?: boolean;
  reverse?: boolean;
}

@singleton()
export class LeaseRepository {
  async findOneByDseqAndOwner(dseq: string, owner: string): Promise<DrainingDeploymentOutput | null> {
    const leases = await Lease.findAll({
      where: { dseq, owner },
      attributes: ["dseq", "owner", "denom", [fn("min", col("predictedClosedHeight")), "predictedClosedHeight"], [fn("sum", col("price")), "blockRate"]],
      group: ["dseq", "owner", "denom"],
      raw: true
    });

    if (leases.length) {
      return leases[0] as unknown as DrainingDeploymentOutput;
    }

    return null;
  }

  async findManyByDseqAndOwner(closureHeight: number, pairs: { dseq: string; owner: string }[]): Promise<DrainingDeploymentOutput[]> {
    if (!pairs.length) return [];

    const leaseOrLeases = await Lease.findAll({
      where: {
        predictedClosedHeight: { [Op.lte]: closureHeight },
        [Op.or]: pairs.map(({ dseq, owner }) => ({
          [Op.and]: [{ dseq, owner }]
        }))
      },
      attributes: [
        "dseq",
        "owner",
        "denom",
        [fn("min", col("predictedClosedHeight")), "predictedClosedHeight"],
        [fn("min", col("closedHeight")), "closedHeight"],
        [fn("sum", col("price")), "blockRate"]
      ],
      group: ["dseq", "owner", "denom"],
      raw: true
    });

    if (Array.isArray(leaseOrLeases)) {
      return leaseOrLeases as unknown as DrainingDeploymentOutput[];
    }

    if (leaseOrLeases && typeof leaseOrLeases === "object") {
      return [leaseOrLeases as unknown as DrainingDeploymentOutput];
    }

    return [];
  }

  async findLeasesWithPagination(params: DatabaseLeaseListParams): Promise<{ count: number; rows: Lease[] }> {
    const { skip = 0, limit = 100, owner, dseq, gseq, oseq, provider, state, reverse = false } = params;

    const whereConditions: WhereOptions = {};

    if (owner) {
      whereConditions.owner = owner;
    }
    if (dseq) {
      whereConditions.dseq = dseq;
    }
    if (gseq !== undefined) {
      whereConditions.gseq = gseq;
    }
    if (oseq !== undefined) {
      whereConditions.oseq = oseq;
    }
    if (provider) {
      whereConditions.providerAddress = provider;
    }
    if (state) {
      if (state === "active") {
        whereConditions.closedHeight = null;
      } else if (state === "closed") {
        whereConditions.closedHeight = { [Op.ne]: null };
      }
    }

    const { count, rows } = await Lease.findAndCountAll({
      where: whereConditions,
      limit,
      offset: skip,
      order: reverse ? [["createdHeight", "DESC"]] : [["createdHeight", "ASC"]],
      include: [
        {
          model: Lease.associations.deployment.target,
          as: "deployment",
          required: false
        }
      ]
    });

    return { count, rows: rows as Lease[] };
  }
}
