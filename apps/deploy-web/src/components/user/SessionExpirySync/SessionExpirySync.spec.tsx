import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { SessionExpiryNotifier } from "@src/services/session-expiry-notifier/session-expiry-notifier.service";
import type { DEPENDENCIES } from "./SessionExpirySync";
import { SessionExpirySync } from "./SessionExpirySync";

import { act, render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(SessionExpirySync.name, () => {
  it("re-checks the session when notified of an expiry", async () => {
    const { notifier, checkSession } = setup();

    await act(async () => notifier.notify());

    expect(checkSession).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst of notifications into a single in-flight re-check", async () => {
    const { notifier, checkSession } = setup({ checkSessionDuration: "pending" });

    await act(async () => {
      notifier.notify();
      notifier.notify();
      notifier.notify();
    });

    expect(checkSession).toHaveBeenCalledTimes(1);
  });

  it("re-checks again once the previous re-check has settled", async () => {
    const { notifier, checkSession } = setup();

    await act(async () => notifier.notify());
    await act(async () => notifier.notify());

    expect(checkSession).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes on unmount", async () => {
    const { notifier, checkSession, unmount } = setup();

    unmount();
    await act(async () => notifier.notify());

    expect(checkSession).not.toHaveBeenCalled();
  });

  function setup(input: { checkSessionDuration?: "settled" | "pending" } = {}) {
    const notifier = new SessionExpiryNotifier();
    const checkSession = vi.fn(() => (input.checkSessionDuration === "pending" ? new Promise<void>(() => undefined) : Promise.resolve()));
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        checkSession,
        isLoading: false,
        user: undefined
      });

    const { unmount } = render(
      <TestContainerProvider services={{ sessionExpiryNotifier: () => notifier }}>
        <SessionExpirySync dependencies={{ useUser }} />
      </TestContainerProvider>
    );

    return { notifier, checkSession, unmount };
  }
});
