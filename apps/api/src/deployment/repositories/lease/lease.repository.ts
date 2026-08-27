import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { col, fn, Op, QueryTypes, Sequelize, WhereOptions } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { DrainingDeploymentLeaseSource } from "@src/deployment/types/draining-deployment";

export interface DrainingDeploymentOutput {
  dseq: number;
  owner: string;
  denom: string;
  blockRate: number;
  predictedClosedHeight: number;
  closedHeight?: number;
}

export interface ActiveLeaseOnProvider {
  owner: string;
  dseq: string;
  providerAddress: string;
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
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  /** Healthy leases come back too, because deciding a deployment is fully dark takes seeing the leases a dark-only filter would drop. */
  async findActiveLeasesOfDeploymentsOnProviders(providers: string[]): Promise<ActiveLeaseOnProvider[]> {
    if (providers.length === 0) return [];

    return await this.#chainDb.query<ActiveLeaseOnProvider>(
      `/* lease:activeOnProviders */
      SELECT l."owner", l."dseq"::text AS "dseq", l."providerAddress"
      FROM lease l
      WHERE l."closedHeight" IS NULL
        AND (l."owner", l."dseq") IN (
          SELECT dark."owner", dark."dseq"
          FROM lease dark
          WHERE dark."providerAddress" IN (:providers)
            AND dark."closedHeight" IS NULL
        )`,
      { type: QueryTypes.SELECT, replacements: { providers } }
    );
  }

  /** Every active lease of a single deployment, so a close can re-check that all of them are still dark before it broadcasts. */
  async findActiveLeasesOfDeployment(owner: string, dseq: string): Promise<ActiveLeaseOnProvider[]> {
    return await this.#chainDb.query<ActiveLeaseOnProvider>(
      `/* lease:activeOfDeployment */
      SELECT l."owner", l."dseq"::text AS "dseq", l."providerAddress"
      FROM lease l
      WHERE l."closedHeight" IS NULL
        AND l."owner" = :owner
        AND l."dseq" = :dseq`,
      { type: QueryTypes.SELECT, replacements: { owner, dseq } }
    );
  }

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
  async findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    if (!dseqs.length) return [];

    const leaseOrLeases = await Lease.findAll({
      where: {
        predictedClosedHeight: { [Op.lte]: closureHeight },
        owner,
        dseq: { [Op.in]: dseqs }
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
