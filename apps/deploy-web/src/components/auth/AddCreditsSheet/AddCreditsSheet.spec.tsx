import React, { useEffect } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { AddCreditsSheet, DEPENDENCIES } from "./AddCreditsSheet";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildApiKey } from "@tests/seeders";
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

  it("does not subscribe to the balance before a purchase succeeds", () => {
    const useWalletBalance = vi.fn<typeof DEPENDENCIES.useWalletBalance>();
    setup({ open: false, dependencies: { useWalletBalance } });

    expect(useWalletBalance).not.toHaveBeenCalled();
  });

  it("keeps a completed purchase visible until the user dismisses it", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100, 5));

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText(/Payment successful/)).toBeInTheDocument();
    expect(screen.getByText(/Your credits are ready to use/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("$100.00 credits added");
    expect(screen.getByRole("status")).toHaveTextContent("Plus $5.00 in bonus credits");
    expect(screen.getByRole("status")).toHaveTextContent("$125.00");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith(100, 5);
  });

  it("labels the success button with the host's next step and forwards the purchase when clicked", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone, nextStepLabel: "Continue to deploy" });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100, 5));
    fireEvent.click(screen.getByRole("button", { name: "Continue to deploy" }));

    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalledExactlyOnceWith(100, 5);
  });

  it("forwards a redemption to onRedeemed", () => {
    const onRedeemed = vi.fn();
    const { dependencies } = setup({ open: true, onRedeemed });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onRedeemed!());

    expect(onRedeemed).toHaveBeenCalled();
  });

  it("omits the bonus when none was granted", () => {
    const { dependencies } = setup({ open: true });

    act(() => dependencies.AddCreditsTabs.mock.calls.at(-1)![0].onDone(100, 0));

    expect(screen.getByRole("status")).toHaveTextContent("$100.00 credits added");
    expect(screen.queryByText(/in bonus credits/)).not.toBeInTheDocument();
  });

  it("waits for a fresh balance instead of displaying the cached balance while loading", () => {
    const useWalletBalance = vi.fn<typeof DEPENDENCIES.useWalletBalance>().mockReturnValue(
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
        isLoading: true,
        balance: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useWalletBalance>["balance"]>>({ totalUsd: 25 })
      })
    );
    const { dependencies, rerender } = setup({ open: true, dependencies: { useWalletBalance } });

    act(() => dependencies.AddCreditsTabs.mock.calls.at(-1)![0].onDone(100));

    expect(screen.getByRole("status")).toHaveTextContent("Updating balance…");
    expect(screen.getByRole("status")).not.toHaveTextContent("$25.00");

    useWalletBalance.mockReturnValue(
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
        isLoading: false,
        balance: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useWalletBalance>["balance"]>>({ totalUsd: 125 })
      })
    );
    rerender(true);

    expect(screen.getByRole("status")).toHaveTextContent("$125.00");
    expect(screen.queryByText("Updating balance…")).not.toBeInTheDocument();
  });

  it("clears the processing guard after the host closes and reopens the sheet", () => {
    const onOpenChange = vi.fn();
    const { dependencies, rerender } = setup({ open: true, onOpenChange });
    act(() => dependencies.AddCreditsTabs.mock.calls.at(-1)![0].onProcessingChange?.(true));

    rerender(false);
    rerender(true);
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(dependencies.SheetContent.mock.calls.at(-1)![0].hideCloseButton).toBe(false);
  });

  it("tracks opening the sheet with the provided context", () => {
    const { analyticsService } = setup({ open: true, context: "skip-trial" });

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_opened", { category: "billing", context: "skip-trial" });
  });

  it("leaves tracking the purchase to the purchase form when the tabs report completion", () => {
    const { analyticsService, dependencies } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(250, 10));

    expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_purchased", expect.anything());
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

  it("forwards the purchase only once when the success screen is dismissed repeatedly", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100, 10));
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onDone).toHaveBeenCalledExactlyOnceWith(100, 10);
  });

  it("starts a fresh form when reopened after a successful purchase", () => {
    const { dependencies, rerender } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];
    act(() => tabsProps.onDone(100));

    rerender(false);
    rerender(true);

    expect(screen.queryByText("Payment successful")).not.toBeInTheDocument();
    expect(screen.getByText(/^Add credits/)).toBeInTheDocument();
  });

  it("threads the initial tab to the tabs", () => {
    const { dependencies } = setup({ open: true, initialTab: "coupon" });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "coupon" }), expect.anything());
  });

  it("threads where the sheet was opened from to the tabs", () => {
    const { dependencies } = setup({ open: true, context: "skip-trial" });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ context: "skip-trial" }), expect.anything());
  });

  it("threads the daily cost of the deployment the credits are for to the tabs", () => {
    const { dependencies } = setup({ open: true, deploymentDailyCostUsd: 12 });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ deploymentDailyCostUsd: 12 }), expect.anything());
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

  describe("when the host suggests a first deployment", () => {
    it("offers to deploy Hello World once a purchase leaves the account without a lease", () => {
      const { purchase } = setup({ open: true, suggestFirstDeployment: true });

      purchase(100);

      expect(screen.getByRole("link", { name: "Deploy now" })).toHaveAttribute(
        "href",
        "/new-deployment/configure?templateId=hello-world&sdl-strategy=default&bid-strategy=auto"
      );
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Deploy with your API key or agent" })).not.toBeInTheDocument();
    });

    it("also offers the API key and agent path to an account holding an API key", () => {
      const { purchase } = setup({ open: true, suggestFirstDeployment: true, apiKeys: { data: [buildApiKey()] } });

      purchase(100);

      expect(screen.getByRole("link", { name: "Deploy with your API key or agent" })).toHaveAttribute("href", "/user/api-keys");
      expect(screen.getByRole("link", { name: "Deploy now" })).toBeInTheDocument();
    });

    it.each([
      { name: "Deploy now", choice: "deploy_now" },
      { name: "Deploy with your API key or agent", choice: "api_key" }
    ])("tracks $choice and closes the sheet with the purchase when $name is clicked", ({ name, choice }) => {
      const onDone = vi.fn();
      const onOpenChange = vi.fn();
      const { purchase, analyticsService } = setup({
        open: true,
        suggestFirstDeployment: true,
        context: "billing_page",
        apiKeys: { data: [buildApiKey()] },
        onDone,
        onOpenChange
      });
      purchase(100, 5);
      const link = screen.getByRole("link", { name });
      link.addEventListener("click", event => event.preventDefault());

      fireEvent.click(link);

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_next_step_clicked", { category: "billing", context: "billing_page", choice });
      expect(onDone).toHaveBeenCalledExactlyOnceWith(100, 5);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("tracks done and closes the sheet with the purchase when the offer is declined", () => {
      const onDone = vi.fn();
      const { purchase, analyticsService } = setup({ open: true, suggestFirstDeployment: true, context: "billing_page", onDone });
      purchase(100, 5);

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_next_step_clicked", { category: "billing", context: "billing_page", choice: "done" });
      expect(onDone).toHaveBeenCalledExactlyOnceWith(100, 5);
    });

    it("keeps only Done for an account that already has a lease, even with an API key", () => {
      const { purchase, dependencies } = setup({
        open: true,
        suggestFirstDeployment: true,
        leaseExistence: { data: true },
        apiKeys: { data: [buildApiKey()] }
      });

      purchase(100);

      expect(screen.queryByRole("link", { name: "Deploy now" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Deploy with your API key or agent" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(dependencies.useUserApiKeys).toHaveBeenLastCalledWith({ enabled: false, refetchInterval: false, retry: false });
    });

    it.each([
      { state: "loading", leaseExistence: { data: undefined } },
      { state: "failed", leaseExistence: { data: undefined, isError: true } }
    ])("keeps only Done while the lease lookup has $state", ({ leaseExistence }) => {
      const { purchase } = setup({ open: true, suggestFirstDeployment: true, leaseExistence });

      purchase(100);

      expect(screen.queryByRole("link", { name: "Deploy now" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    });

    it("keeps only Done until the API key lookup settles", () => {
      const { purchase } = setup({ open: true, suggestFirstDeployment: true, apiKeys: { data: undefined, isSuccess: false, isError: false } });

      purchase(100);

      expect(screen.queryByRole("link", { name: "Deploy now" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    });

    it("still offers to deploy Hello World when the API key lookup fails", () => {
      const { purchase } = setup({ open: true, suggestFirstDeployment: true, apiKeys: { data: undefined, isSuccess: false, isError: true } });

      purchase(100);

      expect(screen.getByRole("link", { name: "Deploy now" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Deploy with your API key or agent" })).not.toBeInTheDocument();
    });

    it("looks up the wallet's leases and the user's API keys while the purchase form is open, without polling", () => {
      const { dependencies } = setup({ open: true, suggestFirstDeployment: true });

      expect(dependencies.useLeaseExistenceQuery).toHaveBeenLastCalledWith("akash1owner", { enabled: true });
      expect(dependencies.useUserApiKeys).toHaveBeenLastCalledWith({ enabled: true, refetchInterval: false, retry: false });
    });

    it.each([
      { reason: "the user has no wallet", wallet: { address: "akash1owner", hasWallet: false } },
      { reason: "the wallet has no address yet", wallet: { address: "", hasWallet: true } }
    ])("does not look up leases when $reason", ({ wallet }) => {
      const { dependencies } = setup({ open: true, suggestFirstDeployment: true, wallet });

      expect(dependencies.useLeaseExistenceQuery).toHaveBeenLastCalledWith(wallet.address, { enabled: false });
    });

    it("looks up nothing while the sheet is closed", () => {
      const { dependencies } = setup({ open: false, suggestFirstDeployment: true });

      expect(dependencies.useLeaseExistenceQuery).not.toHaveBeenCalled();
      expect(dependencies.useUserApiKeys).not.toHaveBeenCalled();
    });
  });

  it("neither looks up nor offers a first deployment, nor tracks Done, when the host does not suggest one", () => {
    const { purchase, analyticsService, dependencies } = setup({ open: true, apiKeys: { data: [buildApiKey()] } });

    purchase(100);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("link", { name: "Deploy now" })).not.toBeInTheDocument();
    expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_next_step_clicked", expect.anything());
    expect(dependencies.useLeaseExistenceQuery).not.toHaveBeenCalled();
    expect(dependencies.useUserApiKeys).not.toHaveBeenCalled();
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
    onDone?: (amount: number, bonusAmount?: number) => void;
    onRedeemed?: () => void;
    initialTab?: "purchase" | "coupon";
    description?: React.ReactNode;
    context?: string;
    nextStepLabel?: string;
    suggestFirstDeployment?: boolean;
    deploymentDailyCostUsd?: number;
    wallet?: { address: string; hasWallet: boolean };
    leaseExistence?: { data?: boolean; isError?: boolean };
    apiKeys?: { data?: ApiKeyResponse[]; isSuccess?: boolean; isError?: boolean };
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const analyticsService = mock<AnalyticsService>();
    const useServices = (() => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })) as typeof DEPENDENCIES.useServices;
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
        isLoading: false,
        balance: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useWalletBalance>["balance"]>>({ totalUsd: 125 })
      });
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>(input.wallet ?? { address: "akash1owner", hasWallet: true });
    const useLeaseExistenceQuery = vi.fn<typeof DEPENDENCIES.useLeaseExistenceQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLeaseExistenceQuery>>(), { data: false, isError: false, ...input.leaseExistence })
    );
    const useUserApiKeys = vi.fn<typeof DEPENDENCIES.useUserApiKeys>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUserApiKeys>>(), { data: [], isSuccess: true, isError: false, ...input.apiKeys })
    );
    const dependencies = MockComponents(DEPENDENCIES, {
      useServices,
      useWalletBalance,
      useWallet,
      useLeaseExistenceQuery,
      useUserApiKeys,
      ...input.dependencies
    });

    const renderSheet = (open: boolean) => (
      <AddCreditsSheet
        open={open}
        onOpenChange={input.onOpenChange ?? vi.fn()}
        onDone={input.onDone ?? vi.fn()}
        onRedeemed={input.onRedeemed}
        initialTab={input.initialTab}
        description={input.description}
        context={input.context}
        nextStepLabel={input.nextStepLabel}
        suggestFirstDeployment={input.suggestFirstDeployment}
        deploymentDailyCostUsd={input.deploymentDailyCostUsd}
        dependencies={dependencies}
      />
    );
    const view = render(renderSheet(input.open));

    return {
      dependencies,
      analyticsService,
      rerender: (open: boolean) => view.rerender(renderSheet(open)),
      purchase: (amount: number, bonusAmount?: number) => act(() => dependencies.AddCreditsTabs.mock.calls.at(-1)![0].onDone(amount, bonusAmount))
    };
  }
});
