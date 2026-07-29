import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useUser } from "@src/hooks/useUser";
import type { WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES } from "./FlagProvider";
import { FlagProvider, UNLEASH_READY_TIMEOUT_MS, WaitForFeatureFlags } from "./FlagProvider";

import { act, render, screen } from "@testing-library/react";

describe(FlagProvider.name, () => {
  it("passes userId from useUser to the custom FlagProvider", () => {
    const customFlagProvider = ({ config, children }: any) => (
      <div data-testid="flag-provider">
        {config.context.userId}
        {children}
      </div>
    );
    const customUseUser = () =>
      mock<ReturnType<typeof useUser>>({
        user: { id: "my-user-id" } as never,
        isLoading: false
      });

    const { getByTestId } = render(
      <FlagProvider components={{ FlagProvider: customFlagProvider, useUser: customUseUser }}>
        <div data-testid="child" />
      </FlagProvider>
    );

    expect(getByTestId("flag-provider").textContent).toContain("my-user-id");
    expect(getByTestId("child")).toBeInTheDocument();
  });

  it("renders children without waiting for feature flags", () => {
    const customFlagProvider = ({ children }: any) => <>{children}</>;
    const customUseUser = () => mock<ReturnType<typeof useUser>>({ user: undefined, isLoading: true });

    const { getByTestId } = render(
      <FlagProvider components={{ FlagProvider: customFlagProvider, useUser: customUseUser }}>
        <div data-testid="child" />
      </FlagProvider>
    );

    expect(getByTestId("child")).toBeInTheDocument();
  });
});

describe(WaitForFeatureFlags.name, () => {
  it("renders children immediately when the client is already ready", () => {
    setup({ isReady: true });
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("shows a loader instead of children while the client is not ready", () => {
    setup({ isReady: false });
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("reveals children when the client becomes ready", () => {
    const { fire } = setup({ isReady: false });

    act(() => fire("ready"));

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("fails open and reveals children when the client errors", () => {
    const { fire } = setup({ isReady: false });

    act(() => fire("error"));

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("fails open and reveals children after the ready timeout", () => {
    vi.useFakeTimers();
    try {
      setup({ isReady: false });

      act(() => {
        vi.advanceTimersByTime(UNLEASH_READY_TIMEOUT_MS);
      });

      expect(screen.getByTestId("child")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unsubscribes from client events on unmount", () => {
    const { client, unmount } = setup({ isReady: false });

    unmount();

    expect(client.off).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(client.off).toHaveBeenCalledWith("error", expect.any(Function));
  });

  function setup(input: { isReady: boolean }) {
    const listeners: Record<string, () => void> = {};
    const client = mock<ReturnType<typeof WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES.useUnleashClient>>();
    client.isReady.mockReturnValue(input.isReady);
    client.once.mockImplementation((event, callback) => {
      listeners[event] = callback as () => void;
      return client;
    });

    const { unmount } = render(
      <WaitForFeatureFlags dependencies={{ useUnleashClient: () => client }}>
        <div data-testid="child" />
      </WaitForFeatureFlags>
    );

    return {
      client,
      unmount,
      fire: (event: string) => listeners[event]?.()
    };
  }
});
