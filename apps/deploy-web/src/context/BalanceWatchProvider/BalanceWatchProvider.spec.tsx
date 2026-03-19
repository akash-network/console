import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BalanceWatchProvider, DEPENDENCIES, useBalanceWatch } from "./BalanceWatchProvider";

import { act, render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders";

describe(BalanceWatchProvider.name, () => {
  it("provides context to children", () => {
    setup({
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("false");
    expect(screen.queryByTestId("is-success")).toHaveTextContent("false");
    expect(screen.queryByTestId("is-time-out")).toHaveTextContent("false");
    expect(screen.queryByTestId("start")).toBeInTheDocument();
    expect(screen.queryByTestId("stop")).toBeInTheDocument();
  });

  it("starts polling and calls refetchBalance on interval", async () => {
    const { refetchBalance, cleanup } = setup({
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("true");
    expect(refetchBalance).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(refetchBalance).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("sets isSuccess to true when balance increases", async () => {
    const initialBalance = buildWalletBalance({ totalUsd: 100 });
    const refetchBalance = vi.fn();
    const useWalletBalance = vi.fn(() => ({
      balance: initialBalance,
      refetch: refetchBalance,
      isLoading: false
    }));

    const dependencies = {
      ...DEPENDENCIES,
      useWalletBalance
    } as unknown as typeof DEPENDENCIES;

    const TestComponent = () => {
      const { start, isActive, isSuccess } = useBalanceWatch();
      return (
        <div>
          <div data-testid="is-active">{isActive.toString()}</div>
          <div data-testid="is-success">{isSuccess.toString()}</div>
          <button data-testid="start" onClick={() => start(100)}>
            Start
          </button>
        </div>
      );
    };

    vi.useFakeTimers();

    const { rerender } = render(
      <BalanceWatchProvider dependencies={dependencies}>
        <TestComponent />
      </BalanceWatchProvider>
    );

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("true");

    const increasedBalance = buildWalletBalance({ totalUsd: 200 });
    useWalletBalance.mockReturnValue({
      balance: increasedBalance,
      refetch: refetchBalance,
      isLoading: false
    });

    await act(async () => {
      rerender(
        <BalanceWatchProvider dependencies={dependencies}>
          <TestComponent />
        </BalanceWatchProvider>
      );
    });

    expect(screen.queryByTestId("is-success")).toHaveTextContent("true");
    expect(screen.queryByTestId("is-active")).toHaveTextContent("false");

    vi.useRealTimers();
  });

  it("detects change using custom balanceKey", async () => {
    const initialBalance = buildWalletBalance({ totalUsd: 100, balanceUACT: 500 });
    const refetchBalance = vi.fn();
    const useWalletBalance = vi.fn(() => ({
      balance: initialBalance,
      refetch: refetchBalance,
      isLoading: false
    }));

    const dependencies = {
      ...DEPENDENCIES,
      useWalletBalance
    } as unknown as typeof DEPENDENCIES;

    const TestComponent = () => {
      const { start, isActive, isSuccess } = useBalanceWatch();
      return (
        <div>
          <div data-testid="is-active">{isActive.toString()}</div>
          <div data-testid="is-success">{isSuccess.toString()}</div>
          <button data-testid="start" onClick={() => start(500, "balanceUACT")}>
            Start
          </button>
        </div>
      );
    };

    vi.useFakeTimers();

    const { rerender } = render(
      <BalanceWatchProvider dependencies={dependencies}>
        <TestComponent />
      </BalanceWatchProvider>
    );

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("true");

    // totalUsd stays the same, but balanceUACT increases
    const updatedBalance = buildWalletBalance({ totalUsd: 100, balanceUACT: 1000 });
    useWalletBalance.mockReturnValue({
      balance: updatedBalance,
      refetch: refetchBalance,
      isLoading: false
    });

    await act(async () => {
      rerender(
        <BalanceWatchProvider dependencies={dependencies}>
          <TestComponent />
        </BalanceWatchProvider>
      );
    });

    expect(screen.queryByTestId("is-success")).toHaveTextContent("true");
    expect(screen.queryByTestId("is-active")).toHaveTextContent("false");

    vi.useRealTimers();
  });

  it("sets isTimeOut to true after max attempts", async () => {
    const { cleanup } = setup({
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("true");

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.queryByTestId("is-time-out")).toHaveTextContent("true");
    expect(screen.queryByTestId("is-active")).toHaveTextContent("false");

    cleanup();
  });

  it("stops polling on manual stop()", async () => {
    setup({
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("true");

    await act(async () => {
      screen.getByTestId("stop").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("false");
  });

  it("prevents concurrent polling", async () => {
    const { refetchBalance } = setup({
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start").click();
    });

    const initialCallCount = refetchBalance.mock.calls.length;

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(refetchBalance.mock.calls.length).toBe(initialCallCount);
  });

  it("cleans up on unmount", async () => {
    const { unmount, cleanup } = setup({
      balance: { totalUsd: 100 },
      isWalletBalanceLoading: false
    });

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-active")).toHaveTextContent("true");

    unmount();

    expect(screen.queryByTestId("is-active")).not.toBeInTheDocument();

    cleanup();
  });

  it("resets isSuccess and isTimeOut on new start", async () => {
    const initialBalance = buildWalletBalance({ totalUsd: 100 });
    const refetchBalance = vi.fn();
    const useWalletBalance = vi.fn(() => ({
      balance: initialBalance,
      refetch: refetchBalance,
      isLoading: false
    }));

    const dependencies = {
      ...DEPENDENCIES,
      useWalletBalance
    } as unknown as typeof DEPENDENCIES;

    const TestComponent = () => {
      const { start, stop, isActive, isSuccess, isTimeOut } = useBalanceWatch();
      return (
        <div>
          <div data-testid="is-active">{isActive.toString()}</div>
          <div data-testid="is-success">{isSuccess.toString()}</div>
          <div data-testid="is-time-out">{isTimeOut.toString()}</div>
          <button data-testid="start" onClick={() => start(100)}>
            Start
          </button>
          <button data-testid="stop" onClick={stop}>
            Stop
          </button>
        </div>
      );
    };

    vi.useFakeTimers();

    const { rerender } = render(
      <BalanceWatchProvider dependencies={dependencies}>
        <TestComponent />
      </BalanceWatchProvider>
    );

    await act(async () => {
      screen.getByTestId("start").click();
    });

    const increasedBalance = buildWalletBalance({ totalUsd: 200 });
    useWalletBalance.mockReturnValue({
      balance: increasedBalance,
      refetch: refetchBalance,
      isLoading: false
    });

    await act(async () => {
      rerender(
        <BalanceWatchProvider dependencies={dependencies}>
          <TestComponent />
        </BalanceWatchProvider>
      );
    });

    expect(screen.queryByTestId("is-success")).toHaveTextContent("true");

    useWalletBalance.mockReturnValue({
      balance: initialBalance,
      refetch: refetchBalance,
      isLoading: false
    });

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(screen.queryByTestId("is-success")).toHaveTextContent("false");
    expect(screen.queryByTestId("is-time-out")).toHaveTextContent("false");

    vi.useRealTimers();
  });

  it("throws error when used outside provider", () => {
    const TestComponent = () => {
      useBalanceWatch();
      return <div>Test</div>;
    };

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useBalanceWatch must be used within a BalanceWatchProvider");

    consoleSpy.mockRestore();
  });

  function setup(input: { balance: { totalUsd: number } | null; isWalletBalanceLoading: boolean }) {
    vi.useFakeTimers();

    const refetchBalance = vi.fn();
    const walletBalance = input.balance ? buildWalletBalance(input.balance) : null;

    const dependencies = {
      ...DEPENDENCIES,
      useWalletBalance: vi.fn(() => ({
        balance: walletBalance,
        refetch: refetchBalance,
        isLoading: input.isWalletBalanceLoading
      }))
    } as unknown as typeof DEPENDENCIES;

    const TestComponent = () => {
      const { start, stop, isActive, isSuccess, isTimeOut } = useBalanceWatch();
      return (
        <div>
          <div data-testid="is-active">{isActive.toString()}</div>
          <div data-testid="is-success">{isSuccess.toString()}</div>
          <div data-testid="is-time-out">{isTimeOut.toString()}</div>
          <button data-testid="start" onClick={() => start(100)}>
            Start
          </button>
          <button data-testid="stop" onClick={stop}>
            Stop
          </button>
        </div>
      );
    };

    const { rerender, unmount } = render(
      <BalanceWatchProvider dependencies={dependencies}>
        <TestComponent />
      </BalanceWatchProvider>
    );

    return {
      refetchBalance,
      rerender,
      unmount,
      cleanup: () => {
        vi.useRealTimers();
      }
    };
  }
});
