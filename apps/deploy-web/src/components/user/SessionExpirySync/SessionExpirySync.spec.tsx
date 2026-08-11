import type { LoggerService } from "@akashnetwork/logging";
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

  it("logs a failed re-check instead of leaking an unhandled rejection", async () => {
    const { notifier, logger } = setup({ checkSessionDuration: "rejected" });

    await act(async () => notifier.notify());

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SESSION_RECHECK_FAILED" }));
  });

  function setup(input: { checkSessionDuration?: "settled" | "pending" | "rejected" } = {}) {
    const notifier = new SessionExpiryNotifier();
    const logger = mock<LoggerService>();
    const checkSession = vi.fn(() => {
      if (input.checkSessionDuration === "pending") return new Promise<void>(() => undefined);
      if (input.checkSessionDuration === "rejected") return Promise.reject(new Error("network down"));
      return Promise.resolve();
    });
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        checkSession,
        isLoading: false,
        user: undefined
      });

    const { unmount } = render(
      <TestContainerProvider services={{ sessionExpiryNotifier: () => notifier, logger: () => logger }}>
        <SessionExpirySync dependencies={{ useUser }} />
      </TestContainerProvider>
    );

    return { notifier, checkSession, logger, unmount };
  }
});
