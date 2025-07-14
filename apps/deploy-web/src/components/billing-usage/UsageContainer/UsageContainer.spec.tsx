import "@testing-library/jest-dom";

import React from "react";

import type { ChildrenProps, UsageContainerProps } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { UsageContainer } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import type { useWallet } from "@src/context/WalletProvider";
import type { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";

import { render } from "@testing-library/react";
import { buildUsageHistory, buildUsageHistoryStats } from "@tests/seeders/usage";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

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
    const usageHistoryData = overrides.usageHistoryData ?? buildUsageHistory();
    const usageHistoryStatsData = overrides.usageHistoryStatsData ?? buildUsageHistoryStats();
    const isFetchingUsageHistory = overrides.isFetchingUsageHistory ?? false;
    const isUsageHistoryError = overrides.isUsageHistoryError ?? false;
    const isFetchingUsageHistoryStats = overrides.isFetchingUsageHistoryStats ?? false;
    const isUsageHistoryStatsError = overrides.isUsageHistoryStatsError ?? false;

    const mockedUseWallet = jest.fn(() => ({ address: "0xABCDEF" })) as unknown as jest.MockedFunction<typeof useWallet>;

    const mockedUseUsage = jest.fn(() => ({
      data: usageHistoryData,
      isError: isUsageHistoryError,
      isFetching: isFetchingUsageHistory
    })) as unknown as jest.MockedFunction<typeof useUsage>;

    const mockedUseUsageStats = jest.fn(() => ({
      data: usageHistoryStatsData,
      isError: isUsageHistoryStatsError,
      isFetching: isFetchingUsageHistoryStats
    })) as unknown as jest.MockedFunction<typeof useUsageStats>;

    const dependencies: NonNullable<UsageContainerProps["dependencies"]> = {
      useWallet: mockedUseWallet,
      useUsage: mockedUseUsage,
      useUsageStats: mockedUseUsageStats
    };

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(<UsageContainer dependencies={dependencies}>{childCapturer.renderChild}</UsageContainer>);

    const child = await childCapturer.awaitChild(() => true);

    return { usageHistoryData, usageHistoryStatsData, child };
  }
});
