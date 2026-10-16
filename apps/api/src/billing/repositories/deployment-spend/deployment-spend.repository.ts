import { QueryTypes, type Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain/providers/sequelize.provider";
import { averageBlockTime } from "@src/utils/constants";

/** Micro-USD amounts as numeric text, so nothing is rounded before a caller sums whole cents. */
export type DeploymentConsumption = { owner: string; dseq: string; settledMicroUsd: string; accruedMicroUsd: string };

export type DeploymentDeposited = { owner: string; dseq: string; depositedMicroUsd: string };

export type DailyDeploymentConsumption = { dseq: string; date: string; consumedMicroUsd: string; hours: number };

export type LandingWindow = { since: Date; until: Date };

const DEPOSIT_MESSAGE_TYPES = [
  "/akash.deployment.v1beta1.MsgDepositDeployment",
  "/akash.deployment.v1beta2.MsgDepositDeployment",
  "/akash.deployment.v1beta3.MsgDepositDeployment",
  "/akash.escrow.v1.MsgAccountDeposit"
];

const MICRO_USD_PER_UNIT = `CASE
  WHEN denom = 'uakt' THEN COALESCE(akt_price, 0)
  WHEN denom IN ('uusdc', 'uact') THEN 1
  ELSE 0
END`;

/** Reads what the chain index recorded per deployment, keyed by owner address like the public usage history it mirrors. */
@singleton()
export class DeploymentSpendRepository {
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  /** Lease price times blocks run per day, as the usage history counts it; blocks past the last settlement come back as accrued. */
  async findConsumedByDeployment({ owners, startDate, endDate }: { owners: string[]; startDate: string; endDate: string }): Promise<DeploymentConsumption[]> {
    if (!owners.length) return [];

    return await this.#chainDb.query<DeploymentConsumption>(
      `/* project-spend:consumed */
      WITH days AS (
        SELECT d."firstBlockHeight" AS first_height, d."lastBlockHeightYet" AS last_height, d."aktPrice" AS akt_price
        FROM day d
        WHERE d.date >= :startDate::date AND d.date <= :endDate::date
      ),
      leases AS (
        SELECT
          l.owner,
          l.dseq,
          l.denom,
          l.price,
          l."createdHeight" AS created_height,
          COALESCE(l."closedHeight", l."predictedClosedHeight") AS end_height,
          CASE WHEN l."closedHeight" IS NULL THEN COALESCE(dep."lastWithdrawHeight", l."createdHeight") ELSE l."closedHeight" END AS settled_height
        FROM lease l
        INNER JOIN deployment dep ON dep.id = l."deploymentId"
        WHERE l.owner IN (:owners)
          AND l."createdHeight" < (SELECT MAX(last_height) FROM days)
          AND COALESCE(l."closedHeight", l."predictedClosedHeight") > (SELECT MIN(first_height) FROM days)
      ),
      spans AS (
        SELECT
          l.owner,
          l.dseq,
          l.denom,
          l.price,
          d.akt_price,
          GREATEST(d.first_height, l.created_height) AS from_height,
          LEAST(d.last_height, l.end_height) AS to_height,
          l.settled_height
        FROM leases l
        INNER JOIN days d ON l.created_height < d.last_height AND l.end_height > d.first_height
      )
      SELECT
        owner,
        dseq,
        SUM(price * GREATEST(0, LEAST(to_height, settled_height) - from_height) * ${MICRO_USD_PER_UNIT})::text AS "settledMicroUsd",
        SUM(price * (to_height - GREATEST(from_height, LEAST(to_height, settled_height))) * ${MICRO_USD_PER_UNIT})::text AS "accruedMicroUsd"
      FROM spans
      GROUP BY owner, dseq`,
      { type: QueryTypes.SELECT, replacements: { owners, startDate, endDate } }
    );
  }

  /** Lease cost per deployment per day, settled or not, and the hours it held at least one lease that day. */
  async findDailyConsumption({ owners, startDate, endDate }: { owners: string[]; startDate: string; endDate: string }): Promise<DailyDeploymentConsumption[]> {
    if (!owners.length) return [];

    return await this.#chainDb.query<DailyDeploymentConsumption>(
      `/* deployment-spend:daily */
      WITH days AS (
        SELECT
          d.date,
          d."firstBlockHeight" AS first_height,
          d."lastBlockHeightYet" AS last_height,
          d."aktPrice" AS akt_price,
          COALESCE(
            EXTRACT(EPOCH FROM last_block.datetime - first_block.datetime) / NULLIF(d."lastBlockHeightYet" - d."firstBlockHeight", 0),
            :averageBlockSeconds
          ) AS seconds_per_block
        FROM day d
        LEFT JOIN block first_block ON first_block.height = d."firstBlockHeight"
        LEFT JOIN block last_block ON last_block.height = d."lastBlockHeightYet"
        WHERE d.date >= :startDate::date AND d.date <= :endDate::date
      ),
      leases AS (
        SELECT l.dseq, l.denom, l.price, l."createdHeight" AS created_height, COALESCE(l."closedHeight", l."predictedClosedHeight") AS end_height
        FROM lease l
        WHERE l.owner IN (:owners)
          AND l."createdHeight" < (SELECT MAX(last_height) FROM days)
          AND COALESCE(l."closedHeight", l."predictedClosedHeight") > (SELECT MIN(first_height) FROM days)
      ),
      spans AS (
        SELECT
          l.dseq,
          d.date,
          d.seconds_per_block,
          l.denom,
          l.price,
          d.akt_price,
          GREATEST(d.first_height, l.created_height) AS from_height,
          LEAST(d.last_height, l.end_height) AS to_height
        FROM leases l
        INNER JOIN days d ON l.created_height < d.last_height AND l.end_height > d.first_height
      ),
      swept AS (
        SELECT
          spans.*,
          MAX(to_height) OVER (PARTITION BY dseq, date ORDER BY from_height, to_height ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
        FROM spans
      )
      SELECT
        dseq,
        to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        SUM(price * (to_height - from_height) * ${MICRO_USD_PER_UNIT})::text AS "consumedMicroUsd",
        (SUM(GREATEST(0, to_height - GREATEST(from_height, covered_until))) * seconds_per_block / 3600)::float8 AS hours
      FROM swept
      GROUP BY dseq, date, seconds_per_block
      ORDER BY date, dseq`,
      { type: QueryTypes.SELECT, replacements: { owners, startDate, endDate, averageBlockSeconds: averageBlockTime } }
    );
  }

  async hasCreateLanded({ owner, dseq, since, until }: LandingWindow & { owner: string; dseq: string }): Promise<boolean> {
    const rows = await this.#chainDb.query(
      `/* deployment-deposit:landed-create */
      SELECT 1 FROM deployment dep
      INNER JOIN block b ON b.height = dep."createdHeight"
      WHERE dep.owner = :owner AND dep.dseq = :dseq AND b.datetime >= :since AND b.datetime <= :until
      LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { owner, dseq, since, until } }
    );

    return rows.length > 0;
  }

  /** The transactions, oldest first, holding a deposit of exactly this amount into the deployment within the window. */
  async findTopUpTxHashes({ owner, dseq, amount, since, until }: LandingWindow & { owner: string; dseq: string; amount: string }): Promise<string[]> {
    const rows = await this.#chainDb.query<{ txHash: string }>(
      `/* deployment-deposit:landed-top-ups */
      SELECT t.hash AS "txHash" FROM message m
      INNER JOIN deployment dep ON dep.id = m."relatedDeploymentId"
      INNER JOIN transaction t ON t.id = m."txId"
      INNER JOIN block b ON b.height = m.height
      WHERE dep.owner = :owner AND dep.dseq = :dseq AND m.type IN (:depositTypes) AND m.amount = :amount
        AND b.datetime >= :since AND b.datetime <= :until
      ORDER BY m.height, m."indexInBlock"`,
      { type: QueryTypes.SELECT, replacements: { owner, dseq, amount, since, until, depositTypes: DEPOSIT_MESSAGE_TYPES } }
    );

    return rows.map(({ txHash }) => txHash);
  }

  async findLatestBlockTime(): Promise<Date | undefined> {
    const [row] = await this.#chainDb.query<{ datetime: Date }>(
      `/* deployment-deposit:latest-block */ SELECT datetime FROM block ORDER BY height DESC LIMIT 1`,
      {
        type: QueryTypes.SELECT
      }
    );

    return row ? new Date(row.datetime) : undefined;
  }

  /** A create's own deposit is what the deployment holds beyond its top-ups, dated by the block that created it; top-ups are dated by theirs. */
  async findDepositedByDeployment({ owners, from, to }: { owners: string[]; from: Date; to: Date }): Promise<DeploymentDeposited[]> {
    if (!owners.length || from >= to) return [];

    return await this.#chainDb.query<DeploymentDeposited>(
      `/* project-spend:deposited */
      WITH deposits AS (
        SELECT dep.owner, dep.dseq, dep.denom, m.amount, d."aktPrice" AS akt_price
        FROM message m
        INNER JOIN deployment dep ON dep.id = m."relatedDeploymentId"
        INNER JOIN block b ON b.height = m.height
        INNER JOIN day d ON d.id = b."dayId"
        WHERE dep.owner IN (:owners) AND m.type IN (:depositTypes) AND b.datetime >= :from AND b.datetime < :to
        UNION ALL
        SELECT
          dep.owner,
          dep.dseq,
          dep.denom,
          dep.deposit - COALESCE(
            (SELECT SUM(top_up.amount) FROM message top_up WHERE top_up."relatedDeploymentId" = dep.id AND top_up.type IN (:depositTypes)),
            0
          ),
          d."aktPrice"
        FROM deployment dep
        INNER JOIN block b ON b.height = dep."createdHeight"
        INNER JOIN day d ON d.id = b."dayId"
        WHERE dep.owner IN (:owners) AND b.datetime >= :from AND b.datetime < :to
      )
      SELECT owner, dseq, SUM(GREATEST(amount, 0) * ${MICRO_USD_PER_UNIT})::text AS "depositedMicroUsd"
      FROM deposits
      GROUP BY owner, dseq`,
      { type: QueryTypes.SELECT, replacements: { owners, from, to, depositTypes: DEPOSIT_MESSAGE_TYPES } }
    );
  }
}
