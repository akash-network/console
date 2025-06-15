import { faker } from "@faker-js/faker";

import type { BillingUsageRawResult } from "@src/billing/repositories/usage/usage.repository";

export class BillingUsageSeeder {
  static create({
    date = faker.date.recent().toISOString().split("T")[0],
    activeLeases = faker.number.int({ min: 0, max: 10 }),
    dailyAktSpent = faker.number.float({ min: 0, max: 100, precision: 0.01 }),
    totalAktSpent = faker.number.float({ min: 0, max: 1000, precision: 0.01 }),
    dailyUsdcSpent = faker.number.float({ min: 0, max: 100, precision: 0.01 }),
    totalUsdcSpent = faker.number.float({ min: 0, max: 1000, precision: 0.01 }),
    dailyUsdSpent = faker.number.float({ min: 0, max: 100, precision: 0.01 }),
    totalUsdSpent = faker.number.float({ min: 0, max: 1000, precision: 0.01 })
  }: Partial<BillingUsageRawResult> = {}): BillingUsageRawResult {
    return {
      date,
      activeLeases,
      dailyAktSpent,
      totalAktSpent,
      dailyUsdcSpent,
      totalUsdcSpent,
      dailyUsdSpent,
      totalUsdSpent
    };
  }
}
