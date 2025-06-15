import { faker } from "@faker-js/faker";
import { format } from "date-fns";
import { mock } from "jest-mock-extended";

import type { UsageService } from "@src/billing/services/usage/usage.service";
import { UsageController } from "./usage.controller";

import { BillingUsageSeeder } from "@test/seeders/billing-usage.seeder";

describe(UsageController.name, () => {
  it("should call usageService.getHistory() and return result", async () => {
    const { address, startDate, endDate, controller, service } = setup();
    const output = [BillingUsageSeeder.create()];

    service.getHistory.mockResolvedValue(output);

    const result = await controller.getHistory(address, startDate, endDate);

    expect(service.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
    expect(result).toEqual(output);
  });

  it("should call usageService.getHistoryStats() and return result", async () => {
    const { address, startDate, endDate, controller, service } = setup();
    const output = {
      totalSpent: 1234.56,
      averagePerDay: 12.34,
      totalLeases: 15,
      averageLeasesPerDay: 1.5
    };

    service.getHistoryStats.mockResolvedValue(output);

    const result = await controller.getHistoryStats(address, startDate, endDate);

    expect(service.getHistoryStats).toHaveBeenCalledWith(address, startDate, endDate);
    expect(result).toEqual(output);
  });

  function setup() {
    const address = faker.finance.ethereumAddress();
    const startDate = format(faker.date.past(), "yyyy-MM-dd");
    const endDate = format(faker.date.recent(), "yyyy-MM-dd");
    const service = mock<UsageService>();
    const controller = new UsageController(service);

    return {
      address,
      startDate,
      endDate,
      controller,
      service
    };
  }
});
