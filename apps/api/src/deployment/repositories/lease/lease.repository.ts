import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { col, fn, Op } from "sequelize";
import { singleton } from "tsyringe";

interface DrainingLeasesOptions {
  closureHeight: number;
  owner: string;
}

export interface DrainingDeploymentOutput {
  dseq: number;
  denom: string;
  blockRate: number;
}

@singleton()
export class LeaseRepository {
  async findDrainingLeases(options: DrainingLeasesOptions): Promise<DrainingDeploymentOutput[]> {
    const leaseOrLeases = await Lease.findAll({
      where: {
        closedHeight: null,
        owner: options.owner,
        predictedClosedHeight: {
          [Op.lte]: options.closureHeight
        }
      },
      attributes: ["dseq", "denom", [fn("sum", col("price")), "blockRate"]],
      group: ["dseq", "denom"],
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
