import type { AkashBlock, Deployment, DeploymentGroup, Provider } from "@akashnetwork/database/dbSchemas/akash";
import { format, subDays } from "date-fns";

import { app, initDb } from "@src/app";
import type { UsageHistoryResponse } from "@src/billing/http-schemas/usage.schema";
import { closeConnections } from "@src/core";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { BlockSeeder } from "@test/seeders/block.seeder";
import { DaySeeder } from "@test/seeders/day.seeder";
import { DeploymentSeeder } from "@test/seeders/deployment.seeder";
import { DeploymentGroupSeeder } from "@test/seeders/deployment-group.seeder";
import { LeaseSeeder } from "@test/seeders/lease.seeder";
import { ProviderSeeder } from "@test/seeders/provider.seeder";

describe("GET /v1/usage/history", () => {
  let providers: Provider[];
  let blocks: AkashBlock[];
  let deployments: Deployment[];
  let deploymentGroups: DeploymentGroup[];
  let owners: string[];

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const dates = [subDays(now, 7), subDays(now, 6), subDays(now, 5), subDays(now, 4), subDays(now, 3), subDays(now, 2), subDays(now, 1), now];

  beforeAll(async () => {
    await initDb();

    providers = await Promise.all([ProviderSeeder.createInDatabase({ deletedHeight: null }), ProviderSeeder.createInDatabase({ deletedHeight: null })]);

    owners = [AkashAddressSeeder.create(), AkashAddressSeeder.create(), AkashAddressSeeder.create()];

    await Promise.all([
      DaySeeder.createInDatabase({
        date: format(dates[0], "yyyy-MM-dd"),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100,
        aktPrice: 2.5
      }),
      DaySeeder.createInDatabase({
        date: format(dates[1], "yyyy-MM-dd"),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 2.75
      }),
      DaySeeder.createInDatabase({
        date: format(dates[2], "yyyy-MM-dd"),
        firstBlockHeight: 201,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300,
        aktPrice: 3.0
      }),
      DaySeeder.createInDatabase({
        date: format(dates[3], "yyyy-MM-dd"),
        firstBlockHeight: 301,
        lastBlockHeight: 400,
        lastBlockHeightYet: 400,
        aktPrice: 3.25
      }),
      DaySeeder.createInDatabase({
        date: format(dates[4], "yyyy-MM-dd"),
        firstBlockHeight: 401,
        lastBlockHeight: 500,
        lastBlockHeightYet: 500,
        aktPrice: 3.5
      }),
      DaySeeder.createInDatabase({
        date: format(dates[5], "yyyy-MM-dd"),
        firstBlockHeight: 501,
        lastBlockHeight: 600,
        lastBlockHeightYet: 600,
        aktPrice: 3.75
      }),
      DaySeeder.createInDatabase({
        date: format(dates[6], "yyyy-MM-dd"),
        firstBlockHeight: 601,
        lastBlockHeight: 700,
        lastBlockHeightYet: 700,
        aktPrice: 4.0
      }),
      DaySeeder.createInDatabase({
        date: format(dates[7], "yyyy-MM-dd"),
        firstBlockHeight: 701,
        lastBlockHeight: 800,
        lastBlockHeightYet: 800,
        aktPrice: 4.25
      })
    ]);

    blocks = await Promise.all([
      BlockSeeder.createInDatabase({
        datetime: dates[0],
        height: 50
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[1],
        height: 150
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[2],
        height: 250
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[3],
        height: 350
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[4],
        height: 450
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[5],
        height: 550
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[6],
        height: 650
      }),
      BlockSeeder.createInDatabase({
        datetime: dates[7],
        height: 750
      })
    ]);

    deployments = await Promise.all([
      DeploymentSeeder.createInDatabase({
        owner: owners[0],
        dseq: "1001",
        createdHeight: blocks[0].height,
        closedHeight: blocks[3].height,
        denom: "uakt"
      }),
      DeploymentSeeder.createInDatabase({
        owner: owners[0],
        dseq: "1002",
        createdHeight: blocks[1].height,
        closedHeight: blocks[5].height,
        denom: "uusdc"
      }),
      DeploymentSeeder.createInDatabase({
        owner: owners[0],
        dseq: "1003",
        createdHeight: blocks[2].height,
        closedHeight: null,
        denom: "uakt"
      }),
      DeploymentSeeder.createInDatabase({
        owner: owners[1],
        dseq: "2001",
        createdHeight: blocks[1].height,
        closedHeight: blocks[4].height,
        denom: "uakt"
      }),
      DeploymentSeeder.createInDatabase({
        owner: owners[1],
        dseq: "2002",
        createdHeight: blocks[3].height,
        closedHeight: null,
        denom: "uusdc"
      }),
      DeploymentSeeder.createInDatabase({
        owner: owners[2],
        dseq: "3001",
        createdHeight: blocks[4].height,
        closedHeight: blocks[6].height,
        denom: "uakt"
      })
    ]);

    deploymentGroups = await Promise.all([
      DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployments[0].id,
        owner: owners[0],
        dseq: "1001"
      }),
      DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployments[1].id,
        owner: owners[0],
        dseq: "1002"
      }),
      DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployments[2].id,
        owner: owners[0],
        dseq: "1003"
      }),
      DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployments[3].id,
        owner: owners[1],
        dseq: "2001"
      }),
      DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployments[4].id,
        owner: owners[1],
        dseq: "2002"
      }),
      DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployments[5].id,
        owner: owners[2],
        dseq: "3001"
      })
    ]);

    await Promise.all([
      LeaseSeeder.createInDatabase({
        owner: owners[0],
        dseq: "1001",
        providerAddress: providers[0].owner,
        createdHeight: blocks[0].height,
        closedHeight: blocks[3].height,
        deploymentId: deployments[0].id,
        deploymentGroupId: deploymentGroups[0].id,
        price: 50,
        denom: "uakt"
      }),
      LeaseSeeder.createInDatabase({
        owner: owners[0],
        dseq: "1002",
        providerAddress: providers[1].owner,
        createdHeight: blocks[1].height,
        closedHeight: blocks[5].height,
        deploymentId: deployments[1].id,
        deploymentGroupId: deploymentGroups[1].id,
        price: 25000,
        denom: "uusdc"
      }),
      LeaseSeeder.createInDatabase({
        owner: owners[0],
        dseq: "1003",
        providerAddress: providers[0].owner,
        createdHeight: blocks[2].height,
        closedHeight: null,
        deploymentId: deployments[2].id,
        deploymentGroupId: deploymentGroups[2].id,
        price: 75,
        denom: "uakt",
        predictedClosedHeight: "1000"
      }),
      LeaseSeeder.createInDatabase({
        owner: owners[1],
        dseq: "2001",
        providerAddress: providers[1].owner,
        createdHeight: blocks[1].height,
        closedHeight: blocks[4].height,
        deploymentId: deployments[3].id,
        deploymentGroupId: deploymentGroups[3].id,
        price: 40,
        denom: "uakt"
      }),
      LeaseSeeder.createInDatabase({
        owner: owners[1],
        dseq: "2002",
        providerAddress: providers[0].owner,
        createdHeight: blocks[3].height,
        closedHeight: null,
        deploymentId: deployments[4].id,
        deploymentGroupId: deploymentGroups[4].id,
        price: 30000,
        denom: "uusdc",
        predictedClosedHeight: "1200"
      })
    ]);
  });

  afterAll(async () => {
    await closeConnections();
  });

  const expectUsageHistory = async (response: Response, expectedLength: number) => {
    expect(response.status).toBe(200);
    const data: UsageHistoryResponse = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(expectedLength);

    if (data.length > 0) {
      const firstItem = data[0];
      expect(firstItem).toHaveProperty("date");
      expect(firstItem).toHaveProperty("activeLeases");
      expect(firstItem).toHaveProperty("dailyAktSpent");
      expect(firstItem).toHaveProperty("totalAktSpent");
      expect(firstItem).toHaveProperty("dailyUsdcSpent");
      expect(firstItem).toHaveProperty("totalUsdcSpent");
      expect(firstItem).toHaveProperty("dailyUsdSpent");
      expect(firstItem).toHaveProperty("totalUsdSpent");

      for (let i = 1; i < data.length; i++) {
        expect(new Date(data[i].date).getTime()).toBeGreaterThan(new Date(data[i - 1].date).getTime());
      }
    }

    return data;
  };

  it("returns usage history for a valid address with default date range", async () => {
    const response = await app.request(`/v1/usage/history?address=${owners[0]}`);
    await expectUsageHistory(response, 31);
  });

  it("returns usage history for a valid address with custom date range", async () => {
    const startDate = format(dates[1], "yyyy-MM-dd");
    const endDate = format(dates[4], "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageHistory(response, 4);

    expect(data[0].date).toBe(startDate);
    expect(data[data.length - 1].date).toBe(endDate);
  });

  it("returns empty array for address with no leases", async () => {
    const response = await app.request(`/v1/usage/history?address=${owners[2]}`);
    const data = await expectUsageHistory(response, 31);

    data.forEach(day => {
      expect(day.activeLeases).toBe(0);
      expect(day.dailyAktSpent).toBe(0);
      expect(day.totalAktSpent).toBe(0);
      expect(day.dailyUsdcSpent).toBe(0);
      expect(day.totalUsdcSpent).toBe(0);
      expect(day.dailyUsdSpent).toBe(0);
      expect(day.totalUsdSpent).toBe(0);
    });
  });

  it("returns usage history with correct cost calculations", async () => {
    const startDate = format(dates[2], "yyyy-MM-dd");
    const endDate = format(dates[3], "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageHistory(response, 2);

    // Verify that costs are calculated correctly
    // During this period, owner[0] should have 2 active leases:
    // - dseq 1001 (uakt, 50 per block, active until blocks[3])
    // - dseq 1003 (uakt, 75 per block, started at blocks[2])
    data.forEach(day => {
      expect(day.dailyAktSpent).toBeGreaterThan(0);
      expect(day.totalAktSpent).toBeGreaterThanOrEqual(day.dailyAktSpent);
      expect(day.dailyUsdSpent).toBeGreaterThan(0);
      expect(day.totalUsdSpent).toBeGreaterThanOrEqual(day.dailyUsdSpent);
    });
  });

  it("handles mixed currency leases correctly", async () => {
    const startDate = format(dates[1], "yyyy-MM-dd");
    const endDate = format(dates[2], "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageHistory(response, 2);

    // During this period, owner[0] should have both AKT and USDC leases active
    data.forEach(day => {
      expect(day.dailyAktSpent).toBeGreaterThanOrEqual(0);
      expect(day.dailyUsdcSpent).toBeGreaterThanOrEqual(0);
      expect(day.dailyUsdSpent).toBeGreaterThan(0);
    });
  });

  it("responds with 400 for invalid address format", async () => {
    const response = await app.request("/v1/usage/history?address=invalid-address");
    expect(response.status).toBe(400);
  });

  it("responds with 400 for invalid date format", async () => {
    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=invalid-date`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when endDate is before startDate", async () => {
    const startDate = format(dates[4], "yyyy-MM-dd");
    const endDate = format(dates[2], "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when date range exceeds 365 days", async () => {
    const startDate = format(subDays(now, 400), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("uses default startDate when not provided", async () => {
    const endDate = format(now, "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&endDate=${endDate}`);
    await expectUsageHistory(response, 31); // 30 days before endDate + endDate itself
  });

  it("uses current date as default endDate when not provided", async () => {
    const startDate = format(subDays(now, 5), "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}`);
    await expectUsageHistory(response, 6); // 5 days + today
  });
});

describe("GET /v1/usage/history/stats", () => {
  let owners: string[];

  beforeAll(async () => {
    owners = [AkashAddressSeeder.create(), AkashAddressSeeder.create()];
  });

  const expectUsageStats = async (response: Response) => {
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("totalSpent");
    expect(data).toHaveProperty("averagePerDay");
    expect(data).toHaveProperty("totalLeases");
    expect(data).toHaveProperty("averageLeasesPerDay");

    expect(typeof data.totalSpent).toBe("number");
    expect(typeof data.averagePerDay).toBe("number");
    expect(typeof data.totalLeases).toBe("number");
    expect(typeof data.averageLeasesPerDay).toBe("number");

    return data;
  };

  it("returns usage stats for a valid address with default date range", async () => {
    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}`);
    await expectUsageStats(response);
  });

  it("returns usage stats for a valid address with custom date range", async () => {
    const now = new Date();
    const startDate = format(subDays(now, 7), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageStats(response);

    expect(data.averagePerDay).toBeGreaterThanOrEqual(0);
    expect(data.averageLeasesPerDay).toBeGreaterThanOrEqual(0);
  });

  it("returns zero stats for address with no usage", async () => {
    const unknownAddress = AkashAddressSeeder.create();
    const response = await app.request(`/v1/usage/history/stats?address=${unknownAddress}`);
    const data = await expectUsageStats(response);

    expect(data.totalSpent).toBe(0);
    expect(data.averagePerDay).toBe(0);
    expect(data.totalLeases).toBe(0);
    expect(data.averageLeasesPerDay).toBe(0);
  });

  it("responds with 400 for invalid address format", async () => {
    const response = await app.request("/v1/usage/history/stats?address=invalid-address");
    expect(response.status).toBe(400);
  });

  it("responds with 400 for invalid date format", async () => {
    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=invalid-date`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when endDate is before startDate", async () => {
    const now = new Date();
    const startDate = format(now, "yyyy-MM-dd");
    const endDate = format(subDays(now, 1), "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when date range exceeds 365 days", async () => {
    const now = new Date();
    const startDate = format(subDays(now, 400), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("calculates correct averages based on date range", async () => {
    const now = new Date();
    const startDate = format(subDays(now, 6), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageStats(response);

    if (data.totalSpent > 0) {
      expect(data.averagePerDay).toBeCloseTo(data.totalSpent / 7, 2);
    }
  });

  it("handles precision correctly for monetary values", async () => {
    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}`);
    const data = await expectUsageStats(response);

    // Check that monetary values are rounded to 2 decimal places
    expect(data.totalSpent.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(data.averagePerDay.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(data.averageLeasesPerDay.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });
});
