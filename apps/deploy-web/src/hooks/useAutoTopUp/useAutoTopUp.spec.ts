import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useAutoTopUp";
import { useAutoTopUp } from "./useAutoTopUp";

import { renderHook } from "@testing-library/react";

describe(useAutoTopUp.name, () => {
  it("enables auto top-up directly when the deployment has enough runway", async () => {
    const { result, setAutoTopUpEnabled, confirm, deposit } = setup({ hoursOfRunway: 3 });

    await result.current.setEnabled(true);

    expect(confirm).not.toHaveBeenCalled();
    expect(deposit).not.toHaveBeenCalled();
    expect(setAutoTopUpEnabled).toHaveBeenCalledWith(true);
  });

  it("requires a deposit before enabling when runway is shorter than the next check window", async () => {
    const { result, setAutoTopUpEnabled, confirm, deposit } = setup({ minutesOfRunway: 1, confirmed: true, depositSucceeds: true });

    await result.current.setEnabled(true);

    expect(confirm).toHaveBeenCalled();
    expect(deposit).toHaveBeenCalled();
    expect(setAutoTopUpEnabled).toHaveBeenCalledWith(true);
  });

  it("does not enable when the required deposit is declined", async () => {
    const { result, setAutoTopUpEnabled, deposit } = setup({ minutesOfRunway: 1, confirmed: false });

    await result.current.setEnabled(true);

    expect(deposit).not.toHaveBeenCalled();
    expect(setAutoTopUpEnabled).not.toHaveBeenCalled();
  });

  it("does not enable when the required deposit fails", async () => {
    const { result, setAutoTopUpEnabled, deposit } = setup({ minutesOfRunway: 1, confirmed: true, depositSucceeds: false });

    await result.current.setEnabled(true);

    expect(deposit).toHaveBeenCalled();
    expect(setAutoTopUpEnabled).not.toHaveBeenCalled();
  });

  it("disables auto top-up without requiring a deposit", async () => {
    const { result, setAutoTopUpEnabled, confirm } = setup({ minutesOfRunway: 1 });

    await result.current.setEnabled(false);

    expect(confirm).not.toHaveBeenCalled();
    expect(setAutoTopUpEnabled).toHaveBeenCalledWith(false);
  });

  it("exposes the real-time escrow metrics from useDeploymentMetrics", () => {
    const { result, realTimeLeft } = setup({ hoursOfRunway: 3 });

    expect(result.current.realTimeLeft).toBe(realTimeLeft);
  });

  function setup(input: { hoursOfRunway?: number; minutesOfRunway?: number; confirmed?: boolean; depositSucceeds?: boolean }) {
    const runwayMs = input.hoursOfRunway != null ? input.hoursOfRunway * 60 * 60 * 1000 : (input.minutesOfRunway ?? 1) * 60 * 1000;
    const timeLeft = new Date(Date.now() + runwayMs);

    const setAutoTopUpEnabled = vi.fn();
    const confirm = vi.fn().mockResolvedValue(input.confirmed ?? true);
    const deposit = vi.fn().mockResolvedValue(input.depositSucceeds ?? true);

    const usePopup: typeof DEPENDENCIES.usePopup = () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm });
    const useCurrencyFormatter: typeof DEPENDENCIES.useCurrencyFormatter = () => (value: number) => `$${value}`;
    const realTimeLeft = { timeLeft, escrow: 0, amountSpent: 0 };
    const useDeploymentMetrics: typeof DEPENDENCIES.useDeploymentMetrics = () => ({
      realTimeLeft,
      deploymentCost: 100
    });
    const useDepositDeployment: typeof DEPENDENCIES.useDepositDeployment = () => ({ deposit });
    const usePricing: typeof DEPENDENCIES.usePricing = () => mock<ReturnType<typeof DEPENDENCIES.usePricing>>({ udenomToUsd: () => 5 });
    const useDeploymentSettingQuery: typeof DEPENDENCIES.useDeploymentSettingQuery = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>>({
        data: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>["data"]>>({ autoTopUpEnabled: false }),
        setAutoTopUpEnabled,
        isLoading: false
      });

    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: "active",
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [{ denom: "uakt", amount: "1000" }] })
      })
    });
    const leases = [mock<LeaseDto>({ id: "1", state: "active" })];

    const { result } = renderHook(() =>
      useAutoTopUp({
        deployment,
        leases,
        dependencies: { usePopup, useCurrencyFormatter, useDeploymentMetrics, useDepositDeployment, usePricing, useDeploymentSettingQuery }
      })
    );

    return { result, setAutoTopUpEnabled, confirm, deposit, realTimeLeft };
  }
});
