import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { col, fn, Op } from "sequelize";
import { singleton } from "tsyringe";

export interface DrainingLeasesOptions {
  closureHeight: number;
  owner: string;
  denom: string;
}

export interface DrainingDeploymentOutput {
  dseq: number;
  denom: string;
  blockRate: number;
  predictedClosedHeight: number;
}

@singleton()
export class LeaseRepository {
  async findDrainingLeases(options: DrainingLeasesOptions): Promise<DrainingDeploymentOutput[]> {
    const leases = await Lease.findAll({
      where: {
        closedHeight: null,
        owner: options.owner,
        denom: options.denom,
        predictedClosedHeight: {
          [Op.lte]: options.closureHeight
        }
      },
      attributes: ["dseq", "denom", [fn("min", col("predictedClosedHeight")), "predictedClosedHeight"], [fn("sum", col("price")), "blockRate"]],
      group: ["dseq", "denom"],
      plain: true
    });

    return leases ? (leases as unknown as DrainingDeploymentOutput[]) : [];
  }
}
