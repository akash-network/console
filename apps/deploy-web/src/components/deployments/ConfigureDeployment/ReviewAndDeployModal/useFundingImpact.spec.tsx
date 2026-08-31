import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/useAccountBalanceOverview";
import type { DEPENDENCIES } from "./useFundingImpact";
import { useFundingImpact } from "./useFundingImpact";
import type { ReviewRow } from "./useReviewRows";

import { renderHook } from "@testing-library/react";

describe(useFundingImpact.name, () => {
  it("hides when escrow is not abstracted", () => {
    const { result } = setup({ isEscrowAbstracted: false });
    expect(result.current).toEqual({ kind: "hidden" });
  });

  it("hides when no row is priced", () => {
    const { result } = setup({ rows: [mock<ReviewRow>({ price: undefined })] });
    expect(result.current).toEqual({ kind: "hidden" });
  });

  it("reports loading while the balance overview is loading", () => {
    const { result } = setup({ overview: { isLoading: true } });
    expect(result.current).toEqual({ kind: "loading" });
  });

  it("reports loading while the funding config has not loaded", () => {
    const { result } = setup({ fundingConfig: undefined });
    expect(result.current).toEqual({ kind: "loading" });
  });

  it("reports loading while the default payment method is loading", () => {
    const { result } = setup({ isPaymentMethodLoading: true });
    expect(result.current).toEqual({ kind: "loading" });
  });

  it("reports the balance as unavailable when the overview errors", () => {
    const { result } = setup({ overview: { isError: true } });
    expect(result.current).toEqual({ kind: "unavailable" });
  });

  it("reports the balance as unavailable when the funding config errors", () => {
    const { result } = setup({ isFundingConfigError: true });
    expect(result.current).toEqual({ kind: "unavailable" });
  });

  it("reports the balance as unavailable when the default payment method errors", () => {
    const { result } = setup({ isPaymentMethodError: true });
    expect(result.current).toEqual({ kind: "unavailable" });
  });

  it("reserves the target runway's worth of the priced rows, drawing only what the bootstrap deposit left", () => {
    const { result } = setup({ overview: { available: 200 } });

    expect(result.current).toMatchObject({
      kind: "visible",
      state: "funded",
      reserveUsd: 144,
      availableNowUsd: 200,
      availableAfterUsd: 56.5
    });
  });

  it("floors the reserve at the bootstrap deposit for a deployment cheaper than the target runway", () => {
    const { result } = setup({ rows: [pricedRow("0.00001")] });

    expect(result.current).toMatchObject({ state: "funded", reserveUsd: 0.5, availableAfterUsd: 200 });
  });

  it("sums every priced row into the reserve", () => {
    const { result } = setup({ rows: [pricedRow("0.005"), pricedRow("0.005"), mock<ReviewRow>({ price: undefined })] });
    expect(result.current).toMatchObject({ reserveUsd: 288 });
  });

  it("bounds the reserve by a runtime limit shorter than the target runway", () => {
    const { result } = setup({ runtimeLimitHours: 12 });
    expect(result.current).toMatchObject({ reserveUsd: 36 });
  });

  it("keeps the target runway when the runtime limit exceeds it", () => {
    const { result } = setup({ runtimeLimitHours: 96 });
    expect(result.current).toMatchObject({ reserveUsd: 144 });
  });

  it("crosses the threshold when available after reserving lands exactly on it", () => {
    const { result } = setup({ overview: { available: 200, autoReloadThreshold: 56.5 } });
    expect(result.current).toMatchObject({ state: "crosses-threshold", thresholdUsd: 56.5 });
  });

  it("stays funded when available after reserving is above the threshold", () => {
    const { result } = setup({ overview: { available: 200, autoReloadThreshold: 56 } });
    expect(result.current).toMatchObject({ state: "funded" });
  });

  it("stays funded without a threshold when no threshold rule applies", () => {
    const { result } = setup({ overview: { available: 200, autoReloadThreshold: null } });
    expect(result.current).toMatchObject({ state: "funded", thresholdUsd: null });
  });

  it("reports not enough available when the reserve exceeds the balance", () => {
    const { result } = setup({ overview: { available: 100 } });
    expect(result.current).toMatchObject({ state: "not-enough-available", reserveUsd: 144, availableNowUsd: 100, availableAfterUsd: null });
  });

  it("ranks not enough available above the missing payment method", () => {
    const { result } = setup({ overview: { available: 100 }, paymentMethod: null });
    expect(result.current).toMatchObject({ state: "not-enough-available" });
  });

  it("never claims a charge without a payment method, even when the threshold would be crossed", () => {
    const { result } = setup({ overview: { available: 200, autoReloadThreshold: 56 }, paymentMethod: null });
    expect(result.current).toMatchObject({ state: "no-payment-method" });
  });

  it("quotes the configured auto top-up amount as the charge", () => {
    const { result } = setup({ walletSettings: { autoReloadAmount: 250 } });
    expect(result.current).toMatchObject({ chargeUsd: 250 });
  });

  it("floors the charge at the minimum auto top-up amount", () => {
    const { result } = setup({ walletSettings: { autoReloadAmount: 10 } });
    expect(result.current).toMatchObject({ chargeUsd: 25 });
  });

  it("falls back to the default auto top-up amount without wallet settings", () => {
    const { result } = setup({ walletSettings: null });
    expect(result.current).toMatchObject({ chargeUsd: 100 });
  });

  it("labels the default card by brand and last digits", () => {
    const { result } = setup({ paymentMethod: { card: { brand: "visa", last4: "4242" } } });
    expect(result.current).toMatchObject({ cardLabel: "Visa **** 4242" });
  });

  it("leaves the card label empty when the payment method has no card", () => {
    const { result } = setup({ paymentMethod: { card: null } });
    expect(result.current).toMatchObject({ cardLabel: null });
  });

  function setup(input: {
    rows?: ReviewRow[];
    runtimeLimitHours?: number;
    isEscrowAbstracted?: boolean;
    overview?: Partial<AccountBalanceOverview>;
    fundingConfig?: { targetRunwayHours: number; balanceHeadroomUsd: number; defaultDepositUsd: number };
    isFundingConfigError?: boolean;
    walletSettings?: { autoReloadAmount?: number } | null;
    paymentMethod?: { card?: { brand: string | null; last4: string | null } | null } | null;
    isPaymentMethodLoading?: boolean;
    isPaymentMethodError?: boolean;
  }) {
    type Dependencies = typeof DEPENDENCIES;
    const overview = Object.assign(mock<AccountBalanceOverview>(), {
      available: 200,
      autoReloadThreshold: null,
      isLoading: false,
      isError: false,
      ...input.overview
    });
    const fundingConfig = Object.assign(mock<ReturnType<Dependencies["useDeploymentFundingConfigQuery"]>>(), {
      data: "fundingConfig" in input ? input.fundingConfig : { targetRunwayHours: 48, balanceHeadroomUsd: 5, defaultDepositUsd: 0.5 },
      isError: input.isFundingConfigError ?? false
    });
    const walletSettings = Object.assign(mock<ReturnType<Dependencies["useWalletSettingsQuery"]>>(), {
      data: input.walletSettings === undefined ? { autoReloadAmount: 100 } : input.walletSettings
    });
    const paymentMethod = Object.assign(mock<ReturnType<Dependencies["useDefaultPaymentMethodQuery"]>>(), {
      data: input.paymentMethod === undefined ? { card: { brand: "visa", last4: "4242" } } : input.paymentMethod,
      isLoading: input.isPaymentMethodLoading ?? false,
      isError: input.isPaymentMethodError ?? false
    });

    const dependencies = {
      useIsEscrowAbstracted: () => input.isEscrowAbstracted ?? true,
      useAccountBalanceOverview: () => overview,
      usePricing: () => Object.assign(mock<ReturnType<Dependencies["usePricing"]>>(), { udenomToUsd: (amount: number) => amount }),
      useWalletSettingsQuery: () => walletSettings,
      useDefaultPaymentMethodQuery: () => paymentMethod,
      useDeploymentFundingConfigQuery: () => fundingConfig
    } as unknown as Dependencies;

    return renderHook(() =>
      useFundingImpact({
        rows: input.rows ?? [pricedRow("0.005")],
        runtimeLimitHours: input.runtimeLimitHours,
        dependencies
      })
    );
  }

  function pricedRow(perBlockAmount: string): ReviewRow {
    return mock<ReviewRow>({ price: { amount: perBlockAmount, denom: "uakt" } });
  }
});
