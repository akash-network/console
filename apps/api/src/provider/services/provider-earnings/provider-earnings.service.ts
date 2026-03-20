import { Block } from "@akashnetwork/database/dbSchemas";
import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import assert from "http-assert";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { ProviderEarningsQuery, ProviderEarningsResponse } from "@src/provider/http-schemas/provider-earnings.schema";

@singleton()
export class ProviderEarningsService {
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  async getProviderEarnings(owner: string, { from, to }: ProviderEarningsQuery): Promise<ProviderEarningsResponse> {
    const provider = await Provider.findOne({
      where: {
        owner
      }
    });
    assert(provider, 404, "Provider not found");

    const [fromBlock, toBlock] = await Promise.all([
      Block.findOne({
        order: [["datetime", "ASC"]],
        where: {
          isProcessed: true,
          totalUUsdSpent: { [Op.not]: null },
          datetime: { [Op.gte]: from }
        }
      }),
      Block.findOne({
        order: [["datetime", "ASC"]],
        where: {
          isProcessed: true,
          totalUUsdSpent: { [Op.not]: null },
          datetime: { [Op.gte]: to }
        }
      })
    ]);
    assert(fromBlock, 404, "From block not found");
    assert(toBlock, 404, "To block not found");

    const earnings = await this.getEarningsAtHeight(provider.owner, fromBlock.height, toBlock.height);

    return {
      earnings: {
        totalUAktEarned: earnings.uakt,
        totalUUsdcEarned: earnings.uusdc,
        totalUUsdEarned: earnings.uusd
      }
    };
  }

  async getEarningsAtHeight(provider: string, providerCreatedHeight: number, height: number) {
    const days = await this.#chainDb.query<{ date: string; aktPrice: number; totalUAkt: number; totalUUsdc: number }>(
      `/* provider-stats:earnings-at-height */
    WITH provider_leases AS (
      SELECT dseq, price, "createdHeight", "closedHeight","predictedClosedHeight", "denom"
      FROM lease
      WHERE "providerAddress"=:provider
    )
    SELECT
      d.date, d."aktPrice",s."totalUAkt",s."totalUUsdc"
    FROM day d
    LEFT JOIN LATERAL (
      WITH active_leases AS (
        SELECT
          l.dseq,
          l.price,
          l.denom,
          (LEAST(d."lastBlockHeightYet", COALESCE(l."closedHeight", l."predictedClosedHeight"), :height) - GREATEST(d."firstBlockHeight", l."createdHeight", :providerCreatedHeight)) AS duration
        FROM provider_leases l
        WHERE
          l."createdHeight" <= LEAST(d."lastBlockHeightYet", :height)
          AND COALESCE(l."closedHeight", l."predictedClosedHeight") >= GREATEST(d."firstBlockHeight", :providerCreatedHeight)
      ),
      billed_leases AS (
        SELECT
          (CASE WHEN l.denom='uakt' THEN l.price*l.duration ELSE 0 END) AS "uakt_earned",
          (CASE WHEN l.denom='uusdc' THEN l.price*l.duration ELSE 0 END) AS "uusdc_earned"
        FROM active_leases l
      )
      SELECT
        SUM(l.uakt_earned) AS "totalUAkt",
        SUM(l.uusdc_earned) AS "totalUUsdc"
      FROM billed_leases l
    ) AS s ON 1=1
    WHERE d."lastBlockHeightYet" >= :providerCreatedHeight AND d."firstBlockHeight" <= :height
    ORDER BY d.date DESC
`,
      {
        type: QueryTypes.SELECT,
        replacements: { provider, height, providerCreatedHeight }
      }
    );

    return days.reduce(
      (acc, d) => {
        acc.uakt += d.totalUAkt ?? 0;
        acc.uusdc += d.totalUUsdc ?? 0;
        acc.uusd += (d.totalUAkt ?? 0) * (d.aktPrice ?? 0) + (d.totalUUsdc ?? 0);
        return acc;
      },
      { uakt: 0, uusdc: 0, uusd: 0 }
    );
  }
}
