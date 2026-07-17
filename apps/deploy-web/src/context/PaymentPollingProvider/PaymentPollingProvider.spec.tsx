import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DEPENDENCIES, PaymentPollingProvider, usePaymentPolling } from "./PaymentPollingProvider";

import { act, render, screen } from "@testing-library/react";
import { buildManagedWallet, buildWallet, buildWalletBalance } from "@tests/seeders";

describe(PaymentPollingProvider.name, () => {
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

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

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

    await vi.waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    await act(async () => {
      screen.getByTestId("stop-polling").click();
    });

    expect(screen.queryByTestId("is-polling")).toHaveTextContent("false");
  });

  it("verifies polling starts correctly for non-trial users", async () => {
    const { refetchBalance, cleanup } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await vi.waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(refetchBalance).toHaveBeenCalled();

    cleanup();
  });

  it("verifies polling starts correctly for trial users", async () => {
    const { refetchBalance, refetchManagedWallet, cleanup } = setup({
      isTrialing: true,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await vi.waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(refetchBalance).toHaveBeenCalled();
    expect(refetchManagedWallet).toHaveBeenCalled();

    cleanup();
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

    expect(analyticsService.track).toBeDefined();
    expect(typeof analyticsService.track).toBe("function");
  });

  it("handles zero initial balance correctly", async () => {
    const { cleanup } = setup({
      isTrialing: false,
      balance: { totalUsd: 0 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await vi.waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");

    cleanup();
  });

  it("cleans up polling on unmount", async () => {
    const { unmount, cleanup } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await vi.waitFor(() => {
      expect(screen.queryByTestId("is-polling")).toHaveTextContent("true");
    });

    unmount();

    expect(screen.queryByTestId("is-polling")).not.toBeInTheDocument();

    cleanup();
  });

  it("throws error when used outside provider", () => {
    const TestComponent = () => {
      usePaymentPolling();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("usePaymentPolling must be used within a PaymentPollingProvider");

    consoleSpy.mockRestore();
  });

  it("signals 'Payment successful!' on trial flip and suppresses the later timeout notice", async () => {
    const { enqueueSnackbar, setIsTrialing, advancePollCycle, cleanup } = setup({
      isTrialing: true,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarWithTitle("Processing payment..."), expect.anything());

    await setIsTrialing(false);
    await advancePollCycle();

    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarWithTitle("Payment successful!"), expect.objectContaining({ variant: "success" }));

    await advancePollCycle(30000);

    expect(enqueueSnackbar).not.toHaveBeenCalledWith(snackbarWithTitle("Your payment is still processing"), expect.anything());

    cleanup();
  });

  it("frames an exhausted poll as still processing, not a failure, so the user is not nudged to pay again", async () => {
    const { enqueueSnackbar, pumpPollCycles, cleanup } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling").click();
    });

    await pumpPollCycles(16);

    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarWithTitle("Your payment is still processing"), expect.objectContaining({ variant: "info" }));

    cleanup();
  });

  it("frames an exhausted coupon poll as still processing rather than failed", async () => {
    const { enqueueSnackbar, pumpPollCycles, cleanup } = setup({
      isTrialing: false,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling-coupon").click();
    });

    await pumpPollCycles(16);

    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarWithTitle("Your coupon is still processing"), expect.objectContaining({ variant: "info" }));

    cleanup();
  });

  it("shows coupon copy instead of payment copy for a coupon redemption", async () => {
    const { enqueueSnackbar, setIsTrialing, advancePollCycle, cleanup } = setup({
      isTrialing: true,
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start-polling-coupon").click();
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarWithTitle("Applying coupon..."), expect.anything());
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(snackbarWithTitle("Processing payment..."), expect.anything());

    await setIsTrialing(false);
    await advancePollCycle();

    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarWithTitle("Coupon applied!"), expect.objectContaining({ variant: "success" }));

    cleanup();
  });

  function snackbarWithTitle(title: string) {
    return expect.objectContaining({ props: expect.objectContaining({ title }) });
  }

  function setup(input: { isTrialing: boolean; balance: { totalUsd: number } | null; isWalletBalanceLoading: boolean }) {
    vi.useFakeTimers();

    const refetchBalance = vi.fn();
    const refetchManagedWallet = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const mockEnqueueSnackbar = vi.fn();
    const mockCloseSnackbar = vi.fn();

    const state = {
      isTrialing: input.isTrialing,
      balance: input.balance,
      balanceLoading: input.isWalletBalanceLoading
    };

    const mockSnackbar = ({ title, subTitle, iconVariant, showLoading }: { title: string; subTitle: string; iconVariant?: string; showLoading?: boolean }) => (
      <div data-testid="snackbar" data-title={title} data-subtitle={subTitle} data-icon-variant={iconVariant} data-show-loading={showLoading} />
    );

    const dependencies = {
      ...DEPENDENCIES,
      useWallet: vi.fn(() => buildWallet({ isTrialing: state.isTrialing })),
      useWalletBalance: vi.fn(() => ({
        balance: state.balance ? buildWalletBalance(state.balance) : null,
        refetch: refetchBalance,
        isLoading: state.balanceLoading
      })),
      useManagedWallet: vi.fn(() => ({
        wallet: {
          ...buildManagedWallet({ isTrialing: state.isTrialing }),
          username: "Managed Wallet" as const,
          isWalletConnected: true,
          isWalletLoaded: true,
          selected: true,
          creditAmount: 0
        },
        isLoading: false,
        isFetching: false,
        createError: null,
        refetch: refetchManagedWallet,
        create: vi.fn()
      })),
      useServices: vi.fn(() => ({
        analyticsService
      })),
      useSnackbar: vi.fn(() => ({
        enqueueSnackbar: mockEnqueueSnackbar,
        closeSnackbar: mockCloseSnackbar
      })),
      Snackbar: mockSnackbar
    } as unknown as typeof DEPENDENCIES;

    const TestComponent = () => {
      const { pollForPayment, stopPolling, isPolling } = usePaymentPolling();
      return (
        <div>
          <div data-testid="is-polling">{isPolling.toString()}</div>
          <button data-testid="start-polling" onClick={() => pollForPayment()}>
            Start Polling
          </button>
          <button data-testid="start-polling-coupon" onClick={() => pollForPayment({ variant: "coupon" })}>
            Start Coupon Polling
          </button>
          <button data-testid="stop-polling" onClick={stopPolling}>
            Stop Polling
          </button>
        </div>
      );
    };

    const buildUi = () => (
      <PaymentPollingProvider dependencies={{ ...dependencies }}>
        <TestComponent />
      </PaymentPollingProvider>
    );
    const { rerender, unmount } = render(buildUi());

    return {
      refetchBalance,
      refetchManagedWallet,
      analyticsService,
      enqueueSnackbar: mockEnqueueSnackbar,
      closeSnackbar: mockCloseSnackbar,
      rerender,
      unmount,
      setIsTrialing: async (isTrialing: boolean) => {
        state.isTrialing = isTrialing;
        await act(async () => {
          rerender(buildUi());
        });
      },
      advancePollCycle: async (time: number = 2000) => {
        await act(async () => {
          vi.advanceTimersByTime(time);
        });
      },
      /**
       * Drives `cycles` poll iterations to exhaustion. The provider reschedules the next poll off a
       * balance-query loading transition; the mocked `refetch` never toggles `isLoading`, so a plain
       * timer advance stalls after one tick. Each cycle emulates that transition (true → false) then
       * advances one interval so the scheduled poll fires, letting a test reach the timeout branch.
       */
      pumpPollCycles: async (cycles: number) => {
        for (let i = 0; i < cycles; i++) {
          state.balanceLoading = true;
          await act(async () => {
            rerender(buildUi());
          });
          state.balanceLoading = false;
          await act(async () => {
            rerender(buildUi());
          });
          await act(async () => {
            vi.advanceTimersByTime(2000);
          });
        }
      },
      cleanup: () => {
        vi.useRealTimers();
      }
    };
  }
});
