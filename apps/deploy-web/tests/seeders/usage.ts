import { faker } from "@faker-js/faker";
import { format } from "date-fns";

import type { UsageHistory, UsageHistoryStats } from "@src/types";

type UsageHistoryOverride = Partial<Omit<UsageHistory[number], "date"> & { date: Date | string }>;

export const buildUsageHistoryItem = ({
  date = faker.date.past(),
  activeDeployments = faker.number.int({ min: 0, max: 10 }),
  dailyAktSpent = faker.number.int({ min: 0, max: 100 }),
  totalAktSpent = faker.number.int({ min: 0, max: 1000 }),
  dailyUsdcSpent = faker.number.int({ min: 0, max: 100 }),
  totalUsdcSpent = faker.number.int({ min: 0, max: 1000 }),
  dailyUsdSpent = faker.number.int({ min: 0, max: 100 }),
  totalUsdSpent = faker.number.int({ min: 0, max: 1000 })
}: UsageHistoryOverride = {}): UsageHistory[number] => {
  return {
    date: date instanceof Date ? format(date, "yyyy-MM-dd") : date,
    activeDeployments,
    dailyAktSpent,
    totalAktSpent,
    dailyUsdcSpent,
    totalUsdcSpent,
    dailyUsdSpent,
    totalUsdSpent
  };
};

export const buildUsageHistory = (overrides: UsageHistoryOverride[] = [], count?: number): UsageHistory => {
  const numberOfItems = count ?? faker.number.int({ min: 1, max: 10 });

  return Array.from({ length: numberOfItems }, () => {
    return buildUsageHistoryItem(overrides.length > 0 ? faker.helpers.arrayElement(overrides) : {});
  });
};

export const buildUsageHistoryStats = (overrides: Partial<UsageHistoryStats> = {}): UsageHistoryStats => {
  return {
    totalSpent: faker.number.int({ min: 0, max: 10000 }),
    averageSpentPerDay: faker.number.float({ min: 0, max: 100 }),
    totalDeployments: faker.number.int({ min: 0, max: 100 }),
    averageDeploymentsPerDay: faker.number.float({ min: 0, max: 10 }),
    ...overrides
  };
};
