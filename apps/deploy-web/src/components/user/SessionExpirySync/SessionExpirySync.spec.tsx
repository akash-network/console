import { useState } from "react";
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
    const { notifier, checkSession } = setup({ checkSessionOutcome: "pending" });

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

  it("logs when a triggered re-check surfaces a session error", async () => {
    const { notifier, logger } = setup({ checkSessionOutcome: "error" });

    await act(async () => notifier.notify());

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SESSION_RECHECK_FAILED" }));
  });

  it("does not log an auth error that no re-check triggered", () => {
    const { logger } = setup({ initialError: new Error("boot profile fetch failed") });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it("does not log when a triggered re-check reports no error", async () => {
    const { notifier, logger } = setup();

    await act(async () => notifier.notify());

    expect(logger.error).not.toHaveBeenCalled();
  });

  it("swallows and logs an unexpected rejection from the re-check", async () => {
    const { notifier, logger } = setup({ checkSessionOutcome: "rejected" });

    await act(async () => notifier.notify());

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SESSION_RECHECK_FAILED" }));
  });

  it("does not log an unrelated error that lands after a clean re-check", async () => {
    const { notifier, logger, surfaceError } = setup();

    await act(async () => notifier.notify());
    await act(async () => surfaceError());

    expect(logger.error).not.toHaveBeenCalled();
  });

  function setup(input: { checkSessionOutcome?: "success" | "pending" | "rejected" | "error"; initialError?: Error } = {}) {
    const notifier = new SessionExpiryNotifier();
    const logger = mock<LoggerService>();
    let surfaceError: () => void = () => undefined;
    const checkSession = vi.fn(async () => {
      if (input.checkSessionOutcome === "pending") return new Promise<void>(() => undefined);
      if (input.checkSessionOutcome === "rejected") throw new Error("network down");
      if (input.checkSessionOutcome === "error") surfaceError();
      return undefined;
    });
    const useUser: typeof DEPENDENCIES.useUser = () => {
      const [error, setError] = useState<Error | undefined>(input.initialError);
      surfaceError = () => setError(new Error("network down"));
      return mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        checkSession,
        isLoading: false,
        user: undefined,
        error
      });
    };

    const { unmount } = render(
      <TestContainerProvider services={{ sessionExpiryNotifier: () => notifier, logger: () => logger }}>
        <SessionExpirySync dependencies={{ useUser }} />
      </TestContainerProvider>
    );

    return { notifier, checkSession, logger, unmount, surfaceError: () => surfaceError() };
  }
});
