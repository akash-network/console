import { singleton } from "tsyringe";

import { BoundedChainQueryService } from "@src/chain/services/bounded-chain-query/bounded-chain-query.service";
import type { ProviderActiveLeasesStats } from "@src/types/graph";

@singleton()
export class ProviderStatsService {
  readonly #boundedChainQuery: BoundedChainQueryService;

  constructor(boundedChainQuery: BoundedChainQueryService) {
    this.#boundedChainQuery = boundedChainQuery;
  }

  async getProviderActiveLeasesGraphData(providerAddress: string) {
    const result = await this.#boundedChainQuery.select<ProviderActiveLeasesStats>(
      `SELECT "date" AS date, COUNT(l."id") AS count
    FROM "day" d
    LEFT JOIN "lease" l
        ON l."providerAddress" = :providerAddress
        AND l."createdHeight" <= d."lastBlockHeightYet"
        AND COALESCE(l."closedHeight", l."predictedClosedHeight") > d."lastBlockHeightYet"
        AND (l."predictedClosedHeight" IS NULL OR l."predictedClosedHeight" > d."lastBlockHeightYet")
    INNER JOIN "provider" p
        ON p."owner" = :providerAddress
    WHERE d."lastBlockHeightYet" >= p."createdHeight"
    GROUP BY "date"
    ORDER BY "date" ASC`,
      { providerAddress: providerAddress }
    );

    if (result.length < 2) {
      return {
        currentValue: 0,
        compareValue: 0,
        snapshots: [] as {
          date: string;
          value: number;
        }[],
        now: {
          count: 0
        },
        compare: {
          count: 0
        }
      };
    }

    const currentValue = result[result.length - 1];
    const compareValue = result[result.length - 2];

    return {
      currentValue: currentValue.count,
      compareValue: compareValue.count,
      snapshots: result.map(day => ({
        date: day.date,
        value: day.count
      })),
      now: {
        count: currentValue.count
      },
      compare: {
        count: compareValue.count
      }
    };
  }
}
