import "@testing-library/jest-dom";

import React from "react";

import type { ChildrenProps } from "@src/components/usage/usage-tab/UsageContainer";
import { UsageContainer } from "@src/components/usage/usage-tab/UsageContainer";
import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";

import { render } from "@testing-library/react";
import { buildUsageHistory, buildUsageHistoryStats } from "@tests/seeders/usage";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

jest.mock("@src/queries", () => ({
  useUsage: jest.fn(),
  useUsageStats: jest.fn()
}));
jest.mock("@src/context/WalletProvider", () => ({
  useWallet: jest.fn()
}));

const mockedUseUsage = useUsage as jest.Mock;
const mockedUseUsageStats = useUsageStats as jest.Mock;
const mockedUseWallet = useWallet as jest.Mock;

describe(UsageContainer.name, () => {
  it("renders usage history and stats with data", async () => {
    const { usageHistoryData, usageHistoryStatsData, child } = await setup();
    expect(child.usageHistoryData).toEqual(usageHistoryData);
    expect(child.usageHistoryStatsData).toEqual(usageHistoryStatsData);
  });

  it("passes through loading flags correctly", async () => {
    const { child } = await setup({
      isFetchingUsageHistory: true,
      isFetchingUsageHistoryStats: true
    });
    expect(child.isFetchingUsageHistory).toBe(true);
    expect(child.isFetchingUsageHistoryStats).toBe(true);
  });

  it("passes through error flags correctly", async () => {
    const { child } = await setup({
      isUsageHistoryError: true,
      isUsageHistoryStatsError: true
    });
    expect(child.isUsageHistoryError).toBe(true);
    expect(child.isUsageHistoryStatsError).toBe(true);
  });

  it("uses default values when data is empty", async () => {
    const { child } = await setup({
      usageHistoryData: [],
      usageHistoryStatsData: {
        totalSpent: 0,
        averageSpentPerDay: 0,
        totalDeployments: 0,
        averageDeploymentsPerDay: 0
      }
    });
    expect(child.usageHistoryData).toEqual([]);
    expect(child.usageHistoryStatsData).toEqual({
      totalSpent: 0,
      averageSpentPerDay: 0,
      totalDeployments: 0,
      averageDeploymentsPerDay: 0
    });
  });

  async function setup(
    overrides: Partial<{
      usageHistoryData: UsageHistory;
      usageHistoryStatsData: UsageHistoryStats;
      isFetchingUsageHistory: boolean;
      isUsageHistoryError: boolean;
      isFetchingUsageHistoryStats: boolean;
      isUsageHistoryStatsError: boolean;
    }> = {}
  ) {
    const defaultUsageHistoryData: UsageHistory = buildUsageHistory();
    const defaultUsageHistoryStatsData: UsageHistoryStats = buildUsageHistoryStats();

    const usageHistoryData = overrides.usageHistoryData ?? defaultUsageHistoryData;
    const usageHistoryStatsData = overrides.usageHistoryStatsData ?? defaultUsageHistoryStatsData;
    const isFetchingUsageHistory = overrides.isFetchingUsageHistory ?? false;
    const isUsageHistoryError = overrides.isUsageHistoryError ?? false;
    const isFetchingUsageHistoryStats = overrides.isFetchingUsageHistoryStats ?? false;
    const isUsageHistoryStatsError = overrides.isUsageHistoryStatsError ?? false;

    mockedUseWallet.mockReturnValue({ address: "0xABCDEF" });

    mockedUseUsage.mockReturnValue({
      data: usageHistoryData,
      isError: isUsageHistoryError,
      isFetching: isFetchingUsageHistory
    });

    mockedUseUsageStats.mockReturnValue({
      data: usageHistoryStatsData,
      isError: isUsageHistoryStatsError,
      isFetching: isFetchingUsageHistoryStats
    });

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(<UsageContainer>{childCapturer.renderChild}</UsageContainer>);

    const child = await childCapturer.awaitChild(() => true);

    return { usageHistoryData, usageHistoryStatsData, child };
  }
});
