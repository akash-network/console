import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { col, fn, Op, WhereOptions } from "sequelize";
import { singleton } from "tsyringe";

import { DrainingDeploymentLeaseSource, LeaseQueryResult } from "@src/deployment/types/draining-deployment";

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
export class LeaseRepository implements DrainingDeploymentLeaseSource {
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

  /**
   * Finds multiple draining deployments by dseqs and owner from the database.
   * Filters by closure height, aggregates lease data by summing block rates (price)
   * and taking minimum predicted closure height and closed height.
   * This implementation assumes that denom is always the same for managed wallets
   * for which these methods are used, allowing direct summation of price values.
   *
   * @param closureHeight - The block height threshold for filtering draining deployments
   * @param owner - Owner address
   * @param dseqs - Array of deployment sequence numbers to filter by
   * @returns Array of draining deployment outputs
   */
  async findActiveDseqsByOwner(owner: string, dseqs: string[]): Promise<Set<string>> {
    if (!dseqs.length) return new Set();

    const results = await Lease.findAll({
      where: {
        owner,
        dseq: { [Op.in]: dseqs },
        closedHeight: null
      },
      attributes: [[fn("DISTINCT", col("dseq")), "dseq"]],
      raw: true
    });

    return new Set((results as unknown as Array<{ dseq: string }>).map(r => String(r.dseq)));
  }

  async findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<LeaseQueryResult> {
    if (!dseqs.length) return { drainingDeployments: [], activeDseqs: new Set() };

    const [leaseOrLeases, activeDseqs] = await Promise.all([
      Lease.findAll({
        where: {
          predictedClosedHeight: { [Op.lte]: closureHeight },
          owner,
          dseq: { [Op.in]: dseqs },
          closedHeight: null
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
      }),
      this.findActiveDseqsByOwner(owner, dseqs)
    ]);

    let drainingDeployments: DrainingDeploymentOutput[];

    if (Array.isArray(leaseOrLeases)) {
      drainingDeployments = leaseOrLeases as unknown as DrainingDeploymentOutput[];
    } else if (leaseOrLeases && typeof leaseOrLeases === "object") {
      drainingDeployments = [leaseOrLeases as unknown as DrainingDeploymentOutput];
    } else {
      drainingDeployments = [];
    }

    return { drainingDeployments, activeDseqs };
  }

  /**
   * Finds leases with pagination support and optional filtering.
   * Supports filtering by owner, dseq, gseq, oseq, provider, and state.
   * Includes associated deployment data in the results.
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Object with total count and array of lease rows
   */
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
