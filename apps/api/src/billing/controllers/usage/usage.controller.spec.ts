import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { UsageService } from "@src/billing/services/usage/usage.service";
import { UsageController } from "./usage.controller";

describe(UsageController.name, () => {
  it("should call usageService.getHistory() and return result", async () => {
    const { controller, service } = setup();
    const address = faker.finance.ethereumAddress();
    const startDate = faker.date.past().toISOString().split("T")[0];
    const endDate = faker.date.recent().toISOString().split("T")[0];
    const output = [
      {
        date: "2024-01-15",
        activeLeases: 3,
        dailyAktSpent: 12.5,
        totalAktSpent: 125.75,
        dailyUsdcSpent: 5.25,
        totalUsdcSpent: 52.5,
        dailyUsdSpent: 17.75,
        totalUsdSpent: 178.25
      }
    ];

    service.getHistory.mockResolvedValue(output);

    const result = await controller.getHistory(address, startDate, endDate);

    expect(service.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
    expect(result).toEqual(output);
  });

  it("should call usageService.getHistoryStats() and return result", async () => {
    const { controller, service } = setup();
    const address = faker.finance.ethereumAddress();
    const startDate = faker.date.past().toISOString().split("T")[0];
    const endDate = faker.date.recent().toISOString().split("T")[0];
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
    const service = mock<UsageService>();
    const controller = new UsageController(service);

    return {
      controller,
      service
    };
  }
});
