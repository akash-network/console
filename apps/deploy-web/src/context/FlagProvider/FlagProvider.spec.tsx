import type { ComponentProps } from "react";
import { FlagProvider as UnleashFlagProvider } from "@unleash/nextjs";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FLAG_CONTEXT_USER_SYNC_DEPENDENCIES, Props, WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES } from "./FlagProvider";
import { FlagContextUserSync, FlagProvider, UNLEASH_READY_TIMEOUT_MS, WaitForFeatureFlags } from "./FlagProvider";

import { act, render, screen } from "@testing-library/react";
import { jsonResponse } from "@tests/unit/jsonResponse";

type Components = NonNullable<Props["components"]>;

describe(FlagProvider.name, () => {
  it("passes userId from useUser to the custom FlagProvider", () => {
    setup({ userId: "my-user-id" });

    expect(screen.getByTestId("flag-provider").textContent).toContain("my-user-id");
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("hands the signed-in user to the flag context sync", () => {
    setup({ userId: "my-user-id" });

    expect(screen.getByTestId("flag-context-user-sync").textContent).toBe("my-user-id");
  });

  it("renders children without waiting for feature flags", () => {
    setup({ isLoading: true });

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  function setup(input: { userId?: string; isLoading?: boolean }) {
    const FlagProviderStub = ({ config, children }: ComponentProps<Components["FlagProvider"]>) => (
      <div data-testid="flag-provider">
        {config?.context?.userId}
        {children}
      </div>
    );
    const FlagContextUserSyncStub = ({ userId }: ComponentProps<Components["FlagContextUserSync"]>) => <div data-testid="flag-context-user-sync">{userId}</div>;
    const useUser: Components["useUser"] = () =>
      mock<ReturnType<Components["useUser"]>>({
        user: input.userId ? { id: input.userId } : undefined,
        isLoading: input.isLoading ?? false
      });

    render(
      <FlagProvider components={{ FlagProvider: FlagProviderStub, FlagContextUserSync: FlagContextUserSyncStub, useUser }}>
        <div data-testid="child" />
      </FlagProvider>
    );
  }
});

describe(FlagContextUserSync.name, () => {
  it("leaves the flag context alone when it already names the signed-in user", () => {
    const { client } = setup({ contextUserId: "user-1", userId: "user-1" });

    expect(client.updateContext).not.toHaveBeenCalled();
  });

  it("leaves the flag context alone while nobody is signed in", () => {
    const { client } = setup({ contextUserId: undefined, userId: undefined });

    expect(client.updateContext).not.toHaveBeenCalled();
  });

  it("identifies a user who signs in after the client was built", () => {
    const { client, rerenderWith } = setup({ contextUserId: undefined, userId: undefined });

    rerenderWith("user-1");

    expect(client.updateContext).toHaveBeenCalledTimes(1);
    expect(client.updateContext).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("identifies a user the client was built without", () => {
    const { client } = setup({ contextUserId: undefined, userId: "user-1" });

    expect(client.updateContext).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("switches the flag context to the next user who signs in", () => {
    const { client, rerenderWith } = setup({ contextUserId: "user-1", userId: "user-1" });

    rerenderWith("user-2");

    expect(client.updateContext).toHaveBeenCalledWith({ userId: "user-2" });
  });

  it("drops the user from the flag context on sign-out", () => {
    const { client, rerenderWith } = setup({ contextUserId: "user-1", userId: "user-1" });

    rerenderWith(undefined);

    expect(client.updateContext).toHaveBeenCalledWith({ userId: undefined });
  });

  it("does not repeat the update on re-renders with the same user", () => {
    const { client, rerenderWith } = setup({ contextUserId: undefined, userId: undefined });

    rerenderWith("user-1");
    rerenderWith("user-1");

    expect(client.updateContext).toHaveBeenCalledTimes(1);
  });

  describe("when driving a real Unleash client", () => {
    it("keeps the session id on the toggles request and only adds a user id while someone is signed in", async () => {
      const { fetchToggles, rerenderWith } = await setupWithRealClient({ sessionId: "session-1" });

      rerenderWith("user-1");
      await vi.waitFor(() => expect(fetchToggles).toHaveBeenCalledTimes(2));
      rerenderWith(undefined);
      await vi.waitFor(() => expect(fetchToggles).toHaveBeenCalledTimes(3));

      expect(fetchToggles.mock.calls.map(([url]) => Object.fromEntries(new URL(url).searchParams))).toEqual([
        { appName: "console", environment: "test", sessionId: "session-1" },
        { appName: "console", environment: "test", sessionId: "session-1", userId: "user-1" },
        { appName: "console", environment: "test", sessionId: "session-1" }
      ]);
    });
  });

  function setup(input: { contextUserId: string | undefined; userId: string | undefined }) {
    let contextUserId = input.contextUserId;
    const client = mock<ReturnType<typeof FLAG_CONTEXT_USER_SYNC_DEPENDENCIES.useUnleashClient>>();
    client.getContext.mockImplementation(() => ({ appName: "console", userId: contextUserId }));
    client.updateContext.mockImplementation(async ({ userId }) => {
      contextUserId = userId;
    });
    const dependencies = { useUnleashClient: () => client };

    const { rerender } = render(<FlagContextUserSync userId={input.userId} dependencies={dependencies} />);

    return {
      client,
      rerenderWith: (userId: string | undefined) => rerender(<FlagContextUserSync userId={userId} dependencies={dependencies} />)
    };
  }

  async function setupWithRealClient(input: { sessionId: string }) {
    const fetchToggles = vi.fn(async (_url: string) => jsonResponse({ toggles: [] }));
    const config = {
      url: "http://unleash.test/api/frontend",
      clientKey: "test-client-key",
      appName: "console",
      environment: "test",
      context: { sessionId: input.sessionId },
      fetch: fetchToggles,
      disableMetrics: true,
      disableRefresh: true,
      storageProvider: { get: async () => undefined, save: async () => undefined }
    };
    const renderTree = (userId: string | undefined) => (
      <UnleashFlagProvider config={config}>
        <FlagContextUserSync userId={userId} />
        <WaitForFeatureFlags>
          <div data-testid="flags-ready" />
        </WaitForFeatureFlags>
      </UnleashFlagProvider>
    );

    const { rerender } = render(renderTree(undefined));
    await screen.findByTestId("flags-ready");

    return { fetchToggles, rerenderWith: (userId: string | undefined) => rerender(renderTree(userId)) };
  }
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

  it("unsubscribes from both client events once readiness resolves", () => {
    const { client, fire } = setup({ isReady: false });

    act(() => fire("ready"));

    expect(client.off).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(client.off).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("unsubscribes from client events on unmount", () => {
    const { client, unmount } = setup({ isReady: false });

    unmount();

    expect(client.off).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(client.off).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("clears the ready timeout on unmount so it cannot fire afterwards", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = setup({ isReady: false });
      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  function setup(input: { isReady: boolean }) {
    const listeners: Record<string, () => void> = {};
    const client = mock<ReturnType<typeof WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES.useUnleashClient>>();
    client.isReady.mockReturnValue(input.isReady);
    client.on.mockImplementation((event, callback) => {
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
