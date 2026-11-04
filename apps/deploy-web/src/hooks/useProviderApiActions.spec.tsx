import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DownloadMessagesResult } from "@src/services/provider-proxy/provider-proxy.service";
import type { DEPENDENCIES } from "./useProviderApiActions";
import { useProviderApiActions } from "./useProviderApiActions";

import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const PROVIDER = { owner: "akash1provider", hostUri: "https://provider.example.com:8443" };

const OTHER_PROVIDER = { owner: "akash1other", hostUri: "https://other.example.com:8443" };

describe(useProviderApiActions.name, () => {
  it("stops a log download from the Cancel button of its toast and shows no failure", async () => {
    const { result, providerProxy, enqueueSnackbar, closeSnackbar } = setup();
    providerProxy.downloadLogs.mockImplementation(
      ({ signal }) => new Promise<DownloadMessagesResult>(resolve => signal?.addEventListener("abort", () => resolve({ ok: false, code: "cancelled" })))
    );

    const download = result.current.downloadLogs(PROVIDER, "1234", 1, 1, true);
    render(enqueueSnackbar.mock.calls[0][0] as ReactElement);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await download;

    expect(screen.getByRole("heading", { name: "Downloading logs..." })).toBeInTheDocument();
    expect(closeSnackbar).toHaveBeenCalledWith("download-toast");
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("shows why a log download failed under its title", async () => {
    const { result, providerProxy, enqueueSnackbar } = setup();
    providerProxy.downloadLogs.mockResolvedValue({ ok: false, code: "unknown", message: "Lease not found" });

    await result.current.downloadLogs(PROVIDER, "1234", 1, 1, false);

    expect(enqueueSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Failed to download events", subTitle: "Lease not found", iconVariant: "error" }) }),
      { variant: "error" }
    );
  });

  it("tells the user the provider could not be reached when a shell download throws", async () => {
    const { result, providerProxy, enqueueSnackbar, logger } = setup();
    const error = new Error("socket hang up");
    providerProxy.downloadFileFromShell.mockRejectedValue(error);

    await result.current.downloadFileFromShell(PROVIDER, "1234", 1, 1, "web", "/app/data.txt");

    expect(logger.error).toHaveBeenCalledWith({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error });
    expect(enqueueSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Failed to download file from shell", subTitle: "Unexpected error. Could not connect to provider." })
      }),
      { variant: "error" }
    );
  });

  it.each([
    { name: "logs", isLogs: true, scope: ["logs", "events"] },
    { name: "events", isLogs: false, scope: ["logs", "events"] }
  ])("asks for a token of each lease's own provider when downloading its $name", async ({ isLogs, scope }) => {
    const { result, providerProxy, providerCredentials } = setup();
    providerProxy.downloadLogs.mockImplementation(async ({ ensureToken }) => {
      await ensureToken();
      return { ok: true };
    });

    await result.current.downloadLogs(PROVIDER, "1234", 1, 1, isLogs);
    await result.current.downloadLogs(OTHER_PROVIDER, "5678", 1, 1, isLogs);

    expect(providerCredentials.ensureToken.mock.calls).toEqual([
      [{ access: { provider: PROVIDER.owner, dseqs: ["1234"], scope } }],
      [{ access: { provider: OTHER_PROVIDER.owner, dseqs: ["5678"], scope } }]
    ]);
  });

  it("asks for a shell token of each lease's own provider when downloading a file", async () => {
    const { result, providerProxy, providerCredentials } = setup();
    providerProxy.downloadFileFromShell.mockImplementation(async ({ ensureToken }) => {
      await ensureToken();
      return { ok: true };
    });

    await result.current.downloadFileFromShell(PROVIDER, "1234", 1, 1, "web", "/app/data.txt");
    await result.current.downloadFileFromShell(OTHER_PROVIDER, "5678", 1, 1, "api", "/app/data.txt");

    expect(providerCredentials.ensureToken.mock.calls).toEqual([
      [{ access: { provider: PROVIDER.owner, dseqs: ["1234"], scope: ["shell"] } }],
      [{ access: { provider: OTHER_PROVIDER.owner, dseqs: ["5678"], scope: ["shell"] } }]
    ]);
  });

  function setup() {
    const enqueueSnackbar = vi.fn().mockReturnValue("download-toast");
    const closeSnackbar = vi.fn();
    const providerProxy = mock<ReturnType<typeof DEPENDENCIES.useServices>["providerProxy"]>();
    const logger = mock<ReturnType<typeof DEPENDENCIES.useServices>["logger"]>();
    const services = mock<ReturnType<typeof DEPENDENCIES.useServices>>({ providerProxy, logger });
    const providerCredentials = mock<ReturnType<typeof DEPENDENCIES.useProviderCredentials>>();
    const dependencies: typeof DEPENDENCIES = {
      useProviderCredentials: () => providerCredentials,
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar }),
      useServices: () => services
    };

    const { result } = renderHook(() => useProviderApiActions(dependencies));

    return { result, providerProxy, providerCredentials, logger, enqueueSnackbar, closeSnackbar };
  }
});
