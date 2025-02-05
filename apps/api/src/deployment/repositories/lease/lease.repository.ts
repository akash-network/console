import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { col, fn, Op } from "sequelize";
import { singleton } from "tsyringe";

export interface DrainingDeploymentOutput {
  dseq: number;
  owner: string;
  denom: string;
  blockRate: number;
  predictedClosedHeight: number;
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
      attributes: ["dseq", "owner", "denom", [fn("min", col("predictedClosedHeight")), "predictedClosedHeight"], [fn("sum", col("price")), "blockRate"]],
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
}
