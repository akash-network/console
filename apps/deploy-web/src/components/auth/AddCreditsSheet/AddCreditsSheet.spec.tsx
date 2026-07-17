import React, { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { AddCreditsSheet, DEPENDENCIES } from "./AddCreditsSheet";

import { act, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AddCreditsSheet.name, () => {
  it("renders the credits tabs when open", () => {
    const { dependencies } = setup({ open: true });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalled();
  });

  it("renders the default description when none is provided", () => {
    setup({ open: true });

    expect(screen.getByText(/this template needs a top-tier gpu/i)).toBeInTheDocument();
  });

  it("renders a custom description instead of the default copy when provided", () => {
    setup({ open: true, description: "Buy credits or redeem a coupon to top up your balance." });

    expect(screen.getByText(/buy credits or redeem a coupon to top up your balance/i)).toBeInTheDocument();
    expect(screen.queryByText(/this template needs a top-tier gpu/i)).not.toBeInTheDocument();
  });

  it("does not render the credits tabs while closed", () => {
    const { dependencies } = setup({ open: false });

    expect(dependencies.AddCreditsTabs).not.toHaveBeenCalled();
  });

  it("forwards a completed purchase to onDone", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100, "Acme", 5));

    expect(onDone).toHaveBeenCalledWith(100, "Acme", 5);
  });

  it("forwards a redemption to onRedeemed", () => {
    const onRedeemed = vi.fn();
    const { dependencies } = setup({ open: true, onRedeemed });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onRedeemed!());

    expect(onRedeemed).toHaveBeenCalled();
  });

  it("tracks opening the sheet with the provided context", () => {
    const { analyticsService } = setup({ open: true, context: "skip-trial" });

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_opened", { category: "billing", context: "skip-trial" });
  });

  it("tracks a purchase when the tabs report completion", () => {
    const { analyticsService, dependencies } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(250, "Acme", 10));

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_purchased", { category: "billing", amount: 250, context: undefined });
  });

  it("tracks a cancellation when the sheet is closed without a purchase", () => {
    const onOpenChange = vi.fn();
    const { analyticsService, dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsTabs: reportingTabs(false) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_cancelled", { category: "billing", context: undefined });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not track a cancellation after a purchase completes", () => {
    const { analyticsService, dependencies } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100));
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_cancelled", expect.anything());
  });

  it("forwards isWalletReady to the tabs", () => {
    const { dependencies } = setup({ open: true, isWalletReady: false });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ isWalletReady: false }), expect.anything());
  });

  it("threads the initial tab to the tabs", () => {
    const { dependencies } = setup({ open: true, initialTab: "coupon" });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "coupon" }), expect.anything());
  });

  it("blocks closing while the tabs report a payment in progress", () => {
    const onOpenChange = vi.fn();
    const { dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsTabs: reportingTabs(true) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("allows closing when no payment is in progress", () => {
    const onOpenChange = vi.fn();
    const { dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsTabs: reportingTabs(false) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides the close button while the tabs report a payment in progress", () => {
    const { dependencies } = setup({ open: true, dependencies: { AddCreditsTabs: reportingTabs(true) } });

    expect(dependencies.SheetContent.mock.calls.at(-1)![0].hideCloseButton).toBe(true);
  });

  function reportingTabs(isProcessing: boolean) {
    return ({ onProcessingChange }: Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0]) => {
      useEffect(() => onProcessingChange?.(isProcessing), [onProcessingChange]);
      return <></>;
    };
  }

  function setup(input: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    onDone?: (amount: number, organization?: string) => void;
    onRedeemed?: () => void;
    isWalletReady?: boolean;
    initialTab?: "purchase" | "coupon";
    description?: React.ReactNode;
    context?: string;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const analyticsService = mock<AnalyticsService>();
    const useServices = (() => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })) as typeof DEPENDENCIES.useServices;
    const dependencies = MockComponents(DEPENDENCIES, { useServices, ...input.dependencies });

    render(
      <AddCreditsSheet
        open={input.open}
        onOpenChange={input.onOpenChange ?? vi.fn()}
        onDone={input.onDone ?? vi.fn()}
        onRedeemed={input.onRedeemed}
        isWalletReady={input.isWalletReady}
        initialTab={input.initialTab}
        description={input.description}
        context={input.context}
        dependencies={dependencies}
      />
    );

    return { dependencies, analyticsService };
  }
});
