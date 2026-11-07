import type { LoggerService } from "@akashnetwork/logging";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AccountStatusRefusalNotifier, createAccountStatusRefusalInterceptor } from "@src/services/account-status-refusal/account-status-refusal";
import type { DEPENDENCIES } from "./AccountStatusSync";
import { AccountStatusSync } from "./AccountStatusSync";

import { act, render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AccountStatusSync.name, () => {
  it("refetches the user on account_suspended", async () => {
    const { notifier, checkSession } = setup();

    await act(async () => notifier.notify({ status: "suspended", reason: "Unpaid invoice" }));

    expect(checkSession).toHaveBeenCalledTimes(1);
  });

  it("explains a suspension with its reason", async () => {
    const { notifier, enqueueSnackbar, Snackbar } = setup();

    await act(async () => notifier.notify({ status: "suspended", reason: "Unpaid invoice" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    expect(Snackbar.mock.calls[0][0]).toEqual({ title: "Your account is suspended", subTitle: "Unpaid invoice", iconVariant: "error" });
  });

  it("explains a termination without a reason by pointing to support", async () => {
    const { notifier, Snackbar } = setup();

    await act(async () => notifier.notify({ status: "terminated", reason: null }));

    expect(Snackbar.mock.calls[0][0]).toEqual({
      title: "Your account has been terminated",
      subTitle: "Contact support to find out more.",
      iconVariant: "error"
    });
  });

  it("turns a burst of refusals into a single reload and toast", async () => {
    const { notifier, checkSession, enqueueSnackbar } = setup({ checkSessionOutcome: "pending" });

    await act(async () => {
      notifier.notify({ status: "suspended", reason: "Unpaid invoice" });
      notifier.notify({ status: "suspended", reason: "Unpaid invoice" });
    });

    expect(checkSession).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("reloads again once the previous reload has settled", async () => {
    const { notifier, checkSession } = setup();

    await act(async () => notifier.notify({ status: "suspended", reason: null }));
    await act(async () => notifier.notify({ status: "suspended", reason: null }));

    expect(checkSession).toHaveBeenCalledTimes(2);
  });

  it("logs a reload that fails and keeps listening", async () => {
    const { notifier, checkSession, logger } = setup({ checkSessionOutcome: "rejected" });

    await act(async () => notifier.notify({ status: "terminated", reason: null }));
    await act(async () => notifier.notify({ status: "terminated", reason: null }));

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "ACCOUNT_STATUS_PROFILE_RELOAD_FAILED" }));
    expect(checkSession).toHaveBeenCalledTimes(2);
  });

  it("neither reloads nor explains a refusal-shaped 403 from the provider proxy", async () => {
    const { notifier, checkSession, enqueueSnackbar } = setup();
    const interceptor = createAccountStatusRefusalInterceptor(notifier);
    const config = { baseURL: "https://provider-proxy.example.com" } as InternalAxiosRequestConfig;
    const response = { status: 403, data: { code: "account_terminated", data: { reason: "Visit evil.example" } }, config } as AxiosResponse;

    await act(async () => {
      await interceptor(new AxiosError("Forbidden", "403", config, undefined, response)).catch(() => undefined);
    });

    expect(checkSession).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", async () => {
    const { notifier, checkSession, unmount } = setup();

    unmount();
    await act(async () => notifier.notify({ status: "suspended", reason: null }));

    expect(checkSession).not.toHaveBeenCalled();
  });

  function setup(input: { checkSessionOutcome?: "success" | "pending" | "rejected" } = {}) {
    const notifier = new AccountStatusRefusalNotifier();
    const logger = mock<LoggerService>();
    const checkSession = vi.fn(async () => {
      if (input.checkSessionOutcome === "pending") return new Promise<void>(() => undefined);
      if (input.checkSessionOutcome === "rejected") throw new Error("network down");
    });
    const enqueueSnackbar = vi.fn((message: React.ReactNode) => {
      render(<>{message}</>);
      return "snackbar-key";
    });
    const Snackbar = vi.fn((_props: { title: string; subTitle: string; iconVariant: string }) => null);
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession });
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });

    const { unmount } = render(
      <TestContainerProvider services={{ accountStatusRefusalNotifier: () => notifier, logger: () => logger }}>
        <AccountStatusSync dependencies={{ useUser, useSnackbar, Snackbar: Snackbar as unknown as typeof DEPENDENCIES.Snackbar }} />
      </TestContainerProvider>
    );

    return { notifier, checkSession, logger, enqueueSnackbar, Snackbar, unmount };
  }
});
