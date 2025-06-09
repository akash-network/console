import { isSameDay, minutesToSeconds } from "date-fns";
import { QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import { ProviderStats, ProviderStatsKey } from "@src/types";
import { env } from "@src/utils/env";

export const emptyProviderGraphData = {
  currentValue: 0,
  compareValue: 0,
  snapshots: [] as {
    date: string;
    value: number;
  }[],
  now: {
    count: 0,
    storage: 0,
    cpu: 0,
    memory: 0,
    gpu: 0
  },
  compare: {
    count: 0,
    storage: 0,
    cpu: 0,
    memory: 0,
    gpu: 0
  }
};

@singleton()
export class ProviderGraphDataService {
  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getProviderGraphData(dataName: ProviderStatsKey) {
    const getter = (block: ProviderStats) => (typeof block[dataName] === "number" ? (block[dataName] as number) : parseInt(block[dataName] as string) || 0);

    const result = this.removeLastAroundMidnight(
      await chainDb.query<ProviderStats>(
        `SELECT d."date", (SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU")) AS "cpu", (SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU")) AS "gpu", (SUM("activeMemory") + SUM("pendingMemory") + SUM("availableMemory")) AS memory, (SUM("activeStorage") + SUM("pendingStorage") + SUM("availableStorage")) as storage, COUNT(*) as count
            FROM "day" d
            INNER JOIN (
            SELECT DISTINCT ON("hostUri",DATE("checkDate"))
              DATE("checkDate") AS date,
              ps."activeCPU", ps."pendingCPU", ps."availableCPU",
              ps."activeGPU", ps."pendingGPU", ps."availableGPU",
              ps."activeMemory", ps."pendingMemory", ps."availableMemory",
              ps."activeEphemeralStorage" + COALESCE(ps."activePersistentStorage", 0) AS "activeStorage", ps."pendingEphemeralStorage" + COALESCE(ps."pendingPersistentStorage", 0) AS "pendingStorage", ps."availableEphemeralStorage" + COALESCE(ps."availablePersistentStorage", 0) AS "availableStorage",
              ps."isOnline"
            FROM "providerSnapshot" ps
            INNER JOIN "day" d ON d."date" = DATE(ps."checkDate")
            INNER JOIN "block" b ON b.height=d."lastBlockHeightYet"
            INNER JOIN "provider" ON "provider"."owner"=ps."owner"
            WHERE ps."isLastSuccessOfDay" = TRUE AND ps."checkDate" >= b."datetime" - (:grace_duration * INTERVAL '1 minutes')
            ORDER BY "hostUri",DATE("checkDate"),"checkDate" DESC
          ) "dailyProviderStats"
          ON DATE(d."date")="dailyProviderStats"."date"
          GROUP BY d."date"
          ORDER BY d."date" ASC`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            grace_duration: env.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES
          }
        }
      )
    );

    if (result.length < 2) {
      return emptyProviderGraphData;
    }

    const currentValue = result[result.length - 1];
    const compareValue = result[result.length - 2];

    const stats = result.map(day => ({
      date: day.date.toISOString(),
      value: getter(day)
    }));

    return {
      currentValue: (typeof currentValue[dataName] === "number" ? currentValue[dataName] : parseInt(currentValue[dataName] as string)) as number,
      compareValue: (typeof compareValue[dataName] === "number" ? compareValue[dataName] : parseInt(compareValue[dataName] as string)) as number,
      snapshots: stats,
      now: {
        count: currentValue.count,
        cpu: parseInt(currentValue.cpu),
        gpu: parseInt(currentValue.gpu),
        memory: parseInt(currentValue.memory),
        storage: parseInt(currentValue.storage)
      },
      compare: {
        count: compareValue.count,
        cpu: parseInt(compareValue.cpu),
        gpu: parseInt(compareValue.gpu),
        memory: parseInt(compareValue.memory),
        storage: parseInt(compareValue.storage)
      }
    };
  }

  private removeLastAroundMidnight(stats: ProviderStats[]) {
    const now = new Date();
    const isFirstFifteenMinuesOfDay = now.getHours() === 0 && now.getMinutes() <= 15;
    const lastItem = stats.length > 0 ? stats[stats.length - 1] : null;

    const lastItemIsForToday = lastItem && isSameDay(lastItem.date, now);
    if (isFirstFifteenMinuesOfDay && lastItemIsForToday) {
      return stats.slice(0, stats.length - 1);
    }

    return stats;
  }
}
