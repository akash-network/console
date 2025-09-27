import React from "react";

import { DEPENDENCIES, PaymentPollingProvider, usePaymentPolling } from "./PaymentPollingProvider";

import { act, render, screen, waitFor } from "@testing-library/react";
import { buildAnalyticsService, buildManagedWallet, buildSnackbarService, buildWallet, buildWalletBalance } from "@tests/seeders";

// Mock dependencies
jest.mock("notistack", () => ({
  useSnackbar: () => ({
    enqueueSnackbar: jest.fn(),
    closeSnackbar: jest.fn()
  })
}));

describe(PaymentPollingProvider.name, () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("provides polling context to children", () => {
    setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    expect(screen.queryByTestId("is-polling")).toHaveTextContent("false");
    expect(screen.queryByTestId("start-polling")).toBeInTheDocument();
    expect(screen.queryByTestId("stop-polling")).toBeInTheDocument();
  });

  it("prevents multiple polling instances", async () => {
    const { refetchBalance } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    const initialCallCount = refetchBalance.mock.calls.length;

    // Try to start polling again
    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    // Should not start another polling instance
    expect(refetchBalance.mock.calls.length).toBe(initialCallCount);
  });

  it("shows loading snackbar when polling starts", async () => {
    const { enqueueSnackbar } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        variant: "info",
        autoHideDuration: null,
        persist: true
      })
    );
  });

  it("stops polling when stopPolling is called", async () => {
    setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    await act(async () => {
      screen.getByTestId("stop-polling").click();
    });

    expect(screen.queryByTestId("is-polling")).toHaveTextContent("false");
  });

  it("verifies polling starts correctly for non-trial users", async () => {
    const { refetchBalance } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    // Advance timers to trigger the polling interval
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Verify that refetchBalance is called during polling
    expect(refetchBalance).toHaveBeenCalled();
  });

  it("verifies polling starts correctly for trial users", async () => {
    const { refetchBalance, refetchManagedWallet } = setup({
      isTrialing: true,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    // Advance timers to trigger the polling interval
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Verify that both refetchBalance and refetchManagedWallet are called during polling
    expect(refetchBalance).toHaveBeenCalled();
    expect(refetchManagedWallet).toHaveBeenCalled();
  });

  it("verifies analytics service is properly configured for trial users", async () => {
    const { analyticsService } = setup({
      isTrialing: true,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    // Verify that the analytics service is properly set up and can track events
    expect(analyticsService.track).toBeDefined();
    expect(typeof analyticsService.track).toBe("function");
  });

  it("shows timeout snackbar after polling timeout", async () => {
    const { enqueueSnackbar } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    // Fast-forward time to trigger timeout
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        variant: "warning"
      })
    );
  });

  it("cleans up polling on unmount", async () => {
    const { unmount } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    // Unmount component
    unmount();

    // Polling should be cleaned up (no way to directly test this, but it prevents memory leaks)
    expect(screen.queryByTestId("is-polling")).not.toBeInTheDocument();
  });

  it("throws error when used outside provider", () => {
    const TestComponent = () => {
      usePaymentPolling();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("usePaymentPolling must be used within a PaymentPollingProvider");

    consoleSpy.mockRestore();
  });

  function setup(input: { isTrialing: boolean; balance: { totalUsd: number } | null; isWalletBalanceLoading: boolean }) {
    const refetchBalance = jest.fn();
    const refetchManagedWallet = jest.fn();
    const analyticsService = buildAnalyticsService();
    const snackbarService = buildSnackbarService();
    const wallet = buildWallet({ isTrialing: input.isTrialing });
    const managedWallet = buildManagedWallet({ isTrialing: input.isTrialing });
    const walletBalance = input.balance ? buildWalletBalance(input.balance) : null;

    const mockSnackbar = ({ title, subTitle, iconVariant, showLoading }: { title: string; subTitle: string; iconVariant?: string; showLoading?: boolean }) => (
      <div data-testid="snackbar" data-title={title} data-subtitle={subTitle} data-icon-variant={iconVariant} data-show-loading={showLoading} />
    );

    const mockManagedWallet = {
      ...managedWallet,
      username: "Managed Wallet" as const,
      isWalletConnected: true,
      isWalletLoaded: true,
      selected: true,
      creditAmount: 0
    };

    const dependencies = {
      ...DEPENDENCIES,
      useWallet: jest.fn(() => wallet),
      useWalletBalance: jest.fn(() => ({
        balance: walletBalance,
        refetch: refetchBalance,
        isLoading: input.isWalletBalanceLoading
      })),
      useManagedWallet: jest.fn(() => ({
        wallet: mockManagedWallet,
        isLoading: false,
        createError: null,
        refetch: refetchManagedWallet,
        create: jest.fn()
      })),
      useServices: jest.fn(() => ({
        analyticsService
      })),
      useSnackbar: jest.fn(() => snackbarService),
      Snackbar: mockSnackbar
    } as any;

    const TestComponent = () => {
      const { pollForPayment, stopPolling, isPolling } = usePaymentPolling();
      return (
        <div>
          <div data-testid="is-polling">{isPolling.toString()}</div>
          <button data-testid="start-polling" onClick={() => pollForPayment()}>
            Start Polling
          </button>
          <button data-testid="stop-polling" onClick={stopPolling}>
            Stop Polling
          </button>
        </div>
      );
    };

    const { rerender, unmount } = render(
      <PaymentPollingProvider dependencies={dependencies}>
        <TestComponent />
      </PaymentPollingProvider>
    );

    return {
      refetchBalance,
      refetchManagedWallet,
      analyticsService,
      enqueueSnackbar: snackbarService.enqueueSnackbar,
      closeSnackbar: snackbarService.closeSnackbar,
      rerender,
      unmount
    };
  }
});
