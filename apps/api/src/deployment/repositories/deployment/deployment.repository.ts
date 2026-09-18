import { Block } from "@akashnetwork/database/dbSchemas";
import { AkashMessage, Deployment, DeploymentGroup, DeploymentGroupResource, Lease } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { FindAndCountOptions, FindOptions, literal, Op, QueryTypes, type Sequelize, WhereOptions } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain";

export interface StaleDeploymentsOptions {
  staleBeforeHeight: number;
  owners: string[];
}

export interface ProviderCleanupOptions {
  owner: string;
  provider: string;
}

export interface DeploymentsBeforeCutoffOptions {
  owner: string;
  cutoffHeight: number;
}

/** Both dates are inclusive calendar days, as the usage history window defines them. */
export interface DeploymentActivityWindow {
  startDate: string;
  endDate: string;
}

/** Heights reach the query through a literal, so anything but a plain integer is refused before it can be interpolated. */
function asHeight(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Expected a block height, received ${value}`);
  }
  return value;
}

function startOfDayAfter(date: string) {
  const dayAfter = new Date(`${date}T00:00:00.000Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  return dayAfter;
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
  dseq: string;
}

export interface StaleDeployment extends StaleDeploymentsOutput {
  owner: string;
}

export interface DeploymentKey {
  owner: string;
  dseq: string;
}

export interface DeploymentClosureState extends DeploymentKey {
  isClosed: boolean;
}

@singleton()
export class DeploymentRepository {
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  /** A deployment the indexer holds no row for is left out rather than reported open, so a caller can tell "still running" from "not indexed". */
  async findClosureStates(deployments: DeploymentKey[]): Promise<DeploymentClosureState[]> {
    if (deployments.length === 0) return [];

    return await this.#chainDb.query<DeploymentClosureState>(
      `/* deployment:closureStatesByOwnerAndDseq */
      SELECT d."owner", d."dseq", d."closedHeight" IS NOT NULL AS "isClosed"
      FROM deployment d
      JOIN unnest($1::text[], $2::text[]) AS t(owner, dseq)
        ON d."owner" = t.owner AND d."dseq" = t.dseq`,
      {
        bind: [deployments.map(deployment => deployment.owner), deployments.map(deployment => deployment.dseq)],
        type: QueryTypes.SELECT
      }
    );
  }

  async findByOwnerAndDseq(owner: string, dseq: string): Promise<Deployment | null> {
    return await Deployment.findOne({
      where: { owner, dseq }
    });
  }

  async countByOwnerAndState(owner: string, state: "active" | "closed"): Promise<number> {
    return await Deployment.count({ where: { owner, closedHeight: state === "active" ? null : { [Op.ne]: null } } });
  }

  async countActiveByOwner(owner: string, window?: DeploymentActivityWindow): Promise<number> {
    if (!window) {
      return await this.countByOwnerAndState(owner, "active");
    }

    return await Deployment.count({
      where: {
        owner,
        "$createdBlock.datetime$": { [Op.lt]: startOfDayAfter(window.endDate) },
        [Op.or]: [{ closedHeight: null }, { "$closedBlock.datetime$": { [Op.gte]: window.startDate } }]
      },
      include: [
        { model: Block, as: "createdBlock" },
        { model: Block, as: "closedBlock" }
      ]
    });
  }

  /**
   * Owners reach the query as one array rather than one call each, so a sweep of every managed wallet costs a query per
   * batch instead of a query per wallet, and the batch that comes back is already only the orphans worth closing.
   */
  async findStaleDeployments(options: StaleDeploymentsOptions): Promise<StaleDeployment[]> {
    if (options.owners.length === 0) return [];

    const staleBeforeHeight = asHeight(options.staleBeforeHeight);

    return await this.#chainDb.query<StaleDeployment>(
      `/* deployment:staleByOwners */
      SELECT d."owner", d."dseq"
      FROM deployment d
      JOIN unnest($1::text[]) AS o(owner) ON d."owner" = o.owner
      WHERE d."closedHeight" IS NULL
        AND d."createdHeight" < $2
        AND NOT EXISTS (
          SELECT 1 FROM lease live
          WHERE live."deploymentId" = d."id" AND live."closedHeight" IS NULL
        )
        AND COALESCE((SELECT MAX(last."closedHeight") FROM lease last WHERE last."deploymentId" = d."id"), 0) < $2`,
      {
        bind: [options.owners, staleBeforeHeight],
        type: QueryTypes.SELECT
      }
    );
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

  async *findAllWithGpuResources(options: { minHeight: number; chunkSize?: number }) {
    const BID_TYPES = ["/akash.market.v1beta4.MsgCreateBid", "/akash.market.v1beta5.MsgCreateBid"];
    const chunkSize = options.chunkSize ?? 1000;
    // A non-positive chunkSize would make `batch.length < chunkSize` never break on an empty
    // result and then dereference batch[-1] for the cursor. chunkSize is internal/test-only, so
    // treat a bad value as a programmer error.
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("findAllWithGpuResources: chunkSize must be a positive integer");
    }
    // Keyset cursor over (createdHeight, id) — the leading columns of the existing
    // `deployment_created_height_closed_height` index, so each chunk is an index scan
    // (no full `deployment` seq scan) and we never prefetch the whole ID list.
    let cursor: { createdHeight: number; id: string } | undefined;

    while (true) {
      const batch = await Deployment.findAll({
        attributes: ["id", "owner", "createdHeight"],
        where: {
          [Op.and]: [
            { createdHeight: { [Op.gte]: options.minHeight } },
            ...(cursor
              ? [
                  {
                    [Op.or]: [{ createdHeight: { [Op.gt]: cursor.createdHeight } }, { createdHeight: cursor.createdHeight, id: { [Op.gt]: cursor.id } }]
                  }
                ]
              : []),
            // Express the single-GPU membership as a non-fanning EXISTS instead of an
            // INNER JOIN: a deployment with >1 matching resource must still be yielded once.
            // Correlates on the main query's "deployment" alias (lowercase, matching the SQL
            // Sequelize emits for this model).
            literal(`EXISTS (
              SELECT 1
              FROM "deploymentGroup" dg
              JOIN "deploymentGroupResource" dgr ON dgr."deploymentGroupId" = dg."id"
              WHERE dg."deploymentId" = "deployment"."id" AND dgr."gpuUnits" = 1
            )`)
          ]
        },
        include: [
          {
            model: AkashMessage,
            as: "relatedMessages",
            // Load bids in a dedicated query keyed on the indexed relatedDeploymentId instead of
            // joining inline. This keeps the main query a pure indexed deployment scan, so LIMIT
            // counts deployments and the keyset cursor stays exact. Joining inline would make
            // LIMIT count joined message rows and a non-bid deployment in the window could shorten
            // a chunk and end paging early.
            separate: true,
            attributes: ["height", "data", "type"],
            where: {
              type: { [Op.in]: BID_TYPES },
              height: { [Op.gte]: options.minHeight }
            },
            include: [
              { model: Block, attributes: ["height", "dayId", "datetime"], required: true },
              { model: Transaction, attributes: ["hash"], required: true }
            ]
          }
        ],
        order: [
          ["createdHeight", "ASC"],
          ["id", "ASC"]
        ] as [string, "ASC" | "DESC"][],
        limit: chunkSize
      });

      for (const deployment of batch) {
        yield deployment;
      }

      if (batch.length < chunkSize) break;
      const last = batch[batch.length - 1];
      cursor = { createdHeight: last.createdHeight, id: last.id };
    }
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
