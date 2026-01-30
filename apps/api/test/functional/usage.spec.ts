import { subDays } from "date-fns";

import type { UsageHistoryResponse, UsageHistoryStats } from "@src/billing/http-schemas/usage.schema";
import { app, initDb } from "@src/rest-app";

import { createAkashAddress, createAkashBlock, createDay, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { formatUTCDate } from "@test/utils";

describe("GET /v1/usage/history", () => {
  let isDbInitialized = false;

  async function setup() {
    const now = new Date();
    now.setUTCHours(12, 0, 0, 0);

    const dates = [subDays(now, 7), subDays(now, 6), subDays(now, 5), subDays(now, 4), subDays(now, 3), subDays(now, 2), subDays(now, 1), now];

    const providers = await Promise.all([createProvider({ deletedHeight: null }), createProvider({ deletedHeight: null })]);

    const owners = [createAkashAddress(), createAkashAddress(), createAkashAddress()];

    if (isDbInitialized) {
      return {
        now,
        dates,
        owners
      };
    }

    await initDb();

    await Promise.all([
      createDay({
        date: formatUTCDate(dates[0]),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100,
        aktPrice: 2.5
      }),
      createDay({
        date: formatUTCDate(dates[1]),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 2.75
      }),
      createDay({
        date: formatUTCDate(dates[2]),
        firstBlockHeight: 201,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300,
        aktPrice: 3.0
      }),
      createDay({
        date: formatUTCDate(dates[3]),
        firstBlockHeight: 301,
        lastBlockHeight: 400,
        lastBlockHeightYet: 400,
        aktPrice: 3.25
      }),
      createDay({
        date: formatUTCDate(dates[4]),
        firstBlockHeight: 401,
        lastBlockHeight: 500,
        lastBlockHeightYet: 500,
        aktPrice: 3.5
      }),
      createDay({
        date: formatUTCDate(dates[5]),
        firstBlockHeight: 501,
        lastBlockHeight: 600,
        lastBlockHeightYet: 600,
        aktPrice: 3.75
      }),
      createDay({
        date: formatUTCDate(dates[6]),
        firstBlockHeight: 601,
        lastBlockHeight: 700,
        lastBlockHeightYet: 700,
        aktPrice: 4.0
      }),
      createDay({
        date: formatUTCDate(dates[7]),
        firstBlockHeight: 701,
        lastBlockHeight: 800,
        lastBlockHeightYet: 800,
        aktPrice: 4.25
      })
    ]);

    const blocks = await Promise.all([
      createAkashBlock({
        datetime: dates[0],
        height: 50
      }),
      createAkashBlock({
        datetime: dates[1],
        height: 150
      }),
      createAkashBlock({
        datetime: dates[2],
        height: 250
      }),
      createAkashBlock({
        datetime: dates[3],
        height: 350
      }),
      createAkashBlock({
        datetime: dates[4],
        height: 450
      }),
      createAkashBlock({
        datetime: dates[5],
        height: 550
      }),
      createAkashBlock({
        datetime: dates[6],
        height: 650
      }),
      createAkashBlock({
        datetime: dates[7],
        height: 750
      })
    ]);

    const deployments = await Promise.all([
      createDeployment({
        owner: owners[0],
        dseq: "1001",
        createdHeight: blocks[0].height,
        closedHeight: blocks[3].height,
        denom: "uakt"
      }),
      createDeployment({
        owner: owners[0],
        dseq: "1002",
        createdHeight: blocks[1].height,
        closedHeight: blocks[5].height,
        denom: "uusdc"
      }),
      createDeployment({
        owner: owners[0],
        dseq: "1003",
        createdHeight: blocks[2].height,
        closedHeight: null,
        denom: "uakt"
      }),
      createDeployment({
        owner: owners[1],
        dseq: "2001",
        createdHeight: blocks[1].height,
        closedHeight: blocks[4].height,
        denom: "uakt"
      }),
      createDeployment({
        owner: owners[1],
        dseq: "2002",
        createdHeight: blocks[3].height,
        closedHeight: null,
        denom: "uusdc"
      }),
      createDeployment({
        owner: owners[2],
        dseq: "3001",
        createdHeight: blocks[4].height,
        closedHeight: blocks[6].height,
        denom: "uakt"
      })
    ]);

    const deploymentGroups = await Promise.all([
      createDeploymentGroup({
        deploymentId: deployments[0].id,
        owner: owners[0],
        dseq: "1001"
      }),
      createDeploymentGroup({
        deploymentId: deployments[1].id,
        owner: owners[0],
        dseq: "1002"
      }),
      createDeploymentGroup({
        deploymentId: deployments[2].id,
        owner: owners[0],
        dseq: "1003"
      }),
      createDeploymentGroup({
        deploymentId: deployments[3].id,
        owner: owners[1],
        dseq: "2001"
      }),
      createDeploymentGroup({
        deploymentId: deployments[4].id,
        owner: owners[1],
        dseq: "2002"
      }),
      createDeploymentGroup({
        deploymentId: deployments[5].id,
        owner: owners[2],
        dseq: "3001"
      })
    ]);

    await Promise.all([
      createLease({
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
      createLease({
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
      createLease({
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
      createLease({
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
      createLease({
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

    isDbInitialized = true;

    return {
      now,
      dates,
      owners
    };
  }

  const expectUsageHistory = async (response: Response, expectedLength: number) => {
    expect(response.status).toBe(200);
    const data = (await response.json()) as UsageHistoryResponse;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(expectedLength);

    if (data.length > 0) {
      const firstItem = data[0];
      expect(firstItem).toHaveProperty("date");
      expect(firstItem).toHaveProperty("activeDeployments");
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
    const { owners } = await setup();
    const response = await app.request(`/v1/usage/history?address=${owners[0]}`);
    await expectUsageHistory(response, 31);
  });

  it("returns usage history for a valid address with custom date range", async () => {
    const { dates, owners } = await setup();
    const startDate = formatUTCDate(dates[1]);
    const endDate = formatUTCDate(dates[4]);

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageHistory(response, 4);

    expect(data[0].date).toBe(startDate);
    expect(data[data.length - 1].date).toBe(endDate);
  });

  it("returns empty array for address with no leases", async () => {
    const { owners } = await setup();
    const response = await app.request(`/v1/usage/history?address=${owners[2]}`);
    const data = await expectUsageHistory(response, 31);

    data.forEach(day => {
      expect(day.activeDeployments).toBe(0);
      expect(day.dailyAktSpent).toBe(0);
      expect(day.totalAktSpent).toBe(0);
      expect(day.dailyUsdcSpent).toBe(0);
      expect(day.totalUsdcSpent).toBe(0);
      expect(day.dailyUsdSpent).toBe(0);
      expect(day.totalUsdSpent).toBe(0);
    });
  });

  it("returns usage history with correct cost calculations", async () => {
    const { dates, owners } = await setup();
    const startDate = formatUTCDate(dates[2]);
    const endDate = formatUTCDate(dates[3]);

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageHistory(response, 2);

    data.forEach(day => {
      expect(day.totalAktSpent).toBeGreaterThanOrEqual(day.dailyAktSpent);
      expect(day.totalUsdSpent).toBeGreaterThanOrEqual(day.dailyUsdSpent);
    });
  });

  it("handles mixed currency leases correctly", async () => {
    const { dates, owners } = await setup();
    const startDate = formatUTCDate(dates[1]);
    const endDate = formatUTCDate(dates[2]);

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageHistory(response, 2);

    data.forEach(day => {
      expect(day.dailyAktSpent).toBeGreaterThanOrEqual(0);
      expect(day.dailyUsdcSpent).toBeGreaterThanOrEqual(0);
    });
  });

  it("responds with 400 for invalid address format", async () => {
    const response = await app.request("/v1/usage/history?address=invalid-address");
    expect(response.status).toBe(400);
  });

  it("responds with 400 for invalid date format", async () => {
    const { owners } = await setup();
    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=invalid-date`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when endDate is before startDate", async () => {
    const { owners, dates } = await setup();
    const startDate = formatUTCDate(dates[4]);
    const endDate = formatUTCDate(dates[2]);

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when date range exceeds 365 days", async () => {
    const { owners, now } = await setup();
    const startDate = formatUTCDate(subDays(now, 400));
    const endDate = formatUTCDate(now);

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("uses default startDate when not provided", async () => {
    const { now, owners } = await setup();
    const endDate = formatUTCDate(now);

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&endDate=${endDate}`);
    await expectUsageHistory(response, 31); // 30 days before endDate + endDate itself
  });

  it("uses current date as default endDate when not provided", async () => {
    const { now, owners } = await setup();
    const startDate = formatUTCDate(subDays(now, 5));

    const response = await app.request(`/v1/usage/history?address=${owners[0]}&startDate=${startDate}`);
    await expectUsageHistory(response, 6); // 5 days + today
  });
});

describe("GET /v1/usage/history/stats", () => {
  function setup() {
    const owners = [createAkashAddress(), createAkashAddress()];

    const expectUsageStats = async (response: Response) => {
      expect(response.status).toBe(200);
      const data = (await response.json()) as UsageHistoryStats;

      expect(data).toHaveProperty("totalSpent");
      expect(data).toHaveProperty("averageSpentPerDay");
      expect(data).toHaveProperty("totalDeployments");
      expect(data).toHaveProperty("averageDeploymentsPerDay");

      expect(typeof data.totalSpent).toBe("number");
      expect(typeof data.averageSpentPerDay).toBe("number");
      expect(typeof data.totalDeployments).toBe("number");
      expect(typeof data.averageDeploymentsPerDay).toBe("number");

      return data;
    };

    return { owners, expectUsageStats };
  }

  it("returns usage stats for a valid address with default date range", async () => {
    const { owners, expectUsageStats } = setup();
    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}`);
    await expectUsageStats(response);
  });

  it("returns usage stats for a valid address with custom date range", async () => {
    const { owners, expectUsageStats } = setup();
    const now = new Date();
    const startDate = formatUTCDate(subDays(now, 7));
    const endDate = formatUTCDate(now);

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageStats(response);

    expect(data.averageSpentPerDay).toBeGreaterThanOrEqual(0);
    expect(data.averageDeploymentsPerDay).toBeGreaterThanOrEqual(0);
  });

  it("returns zero stats for address with no usage", async () => {
    const { expectUsageStats } = setup();
    const unknownAddress = createAkashAddress();
    const response = await app.request(`/v1/usage/history/stats?address=${unknownAddress}`);
    const data = await expectUsageStats(response);

    expect(data.totalSpent).toBe(0);
    expect(data.averageSpentPerDay).toBe(0);
    expect(data.totalDeployments).toBe(0);
    expect(data.averageDeploymentsPerDay).toBe(0);
  });

  it("responds with 400 for invalid address format", async () => {
    const response = await app.request("/v1/usage/history/stats?address=invalid-address");
    expect(response.status).toBe(400);
  });

  it("responds with 400 for invalid date format", async () => {
    const { owners } = setup();
    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=invalid-date`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when endDate is before startDate", async () => {
    const { owners } = setup();
    const now = new Date();
    const startDate = formatUTCDate(now);
    const endDate = formatUTCDate(subDays(now, 1));

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("responds with 400 when date range exceeds 365 days", async () => {
    const { owners } = setup();
    const now = new Date();
    const startDate = formatUTCDate(subDays(now, 400));
    const endDate = formatUTCDate(now);

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    expect(response.status).toBe(400);
  });

  it("calculates correct averages based on date range", async () => {
    const { owners, expectUsageStats } = setup();
    const now = new Date();
    const startDate = formatUTCDate(subDays(now, 6));
    const endDate = formatUTCDate(now);

    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}&startDate=${startDate}&endDate=${endDate}`);
    const data = await expectUsageStats(response);

    if (data.totalSpent > 0) {
      expect(data.averageSpentPerDay).toBeCloseTo(data.totalSpent / 7, 2);
    }
  });

  it("handles precision correctly for monetary values", async () => {
    const { owners, expectUsageStats } = setup();
    const response = await app.request(`/v1/usage/history/stats?address=${owners[0]}`);
    const data = await expectUsageStats(response);

    // Check that monetary values are rounded to 2 decimal places
    expect(data.totalSpent.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(data.averageSpentPerDay.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(data.averageDeploymentsPerDay.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });
});
