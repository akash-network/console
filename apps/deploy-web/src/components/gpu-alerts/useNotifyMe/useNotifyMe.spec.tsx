import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DEPENDENCIES, useNotifyMe } from "./useNotifyMe";

import { act, render, screen, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const WAITING_ENTRY = { id: "entry-1", vendor: "nvidia", model: "h100", memory: null, interface: null, gpuCount: 2, placeInLine: 4 };

describe(useNotifyMe.name, () => {
  it("joins the waitlist and confirms the place in line", async () => {
    const { result, joinGpuWaitlist, enqueueSnackbar } = setup({
      joinOutcome: Promise.resolve({ data: { ...WAITING_ENTRY, placeInLine: 7 } })
    });

    await act(async () => result.current.notify({ vendor: "nvidia", model: "h100", gpuCount: 2, label: "NVIDIA H100" }, "gpu_menu"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(joinGpuWaitlist).toHaveBeenCalledWith({
      data: { vendor: "nvidia", model: "h100", memory: undefined, interface: undefined, gpuCount: 2, source: "gpu_menu" }
    });
    render(enqueueSnackbar.mock.calls[0][0]);
    expect(screen.getByText("You're #7 in line for NVIDIA H100")).toBeInTheDocument();
  });

  it("tracks gpu_alert_joined with the source", async () => {
    const { result, analyticsService } = setup({});

    await act(async () => result.current.notify({ vendor: "nvidia", model: "h100", gpuCount: 2 }, "no_bids"));

    await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("gpu_alert_joined", expect.objectContaining({ source: "no_bids" })));
  });

  it("sends the setup's vendor", async () => {
    const { result, joinGpuWaitlist } = setup({});

    await act(async () => result.current.notify({ vendor: "amd", model: "mi300", gpuCount: 1 }, "gpu_menu"));

    await waitFor(() => expect(joinGpuWaitlist).toHaveBeenCalledWith({ data: expect.objectContaining({ vendor: "amd", model: "mi300" }) }));
  });

  it("shows the API message when joining is refused", async () => {
    const refusal = new ApiError(409, { message: "You can only wait on 10 pools at once" }, "POST /v1/gpu-waitlist → 409");
    const { result, enqueueSnackbar, analyticsService } = setup({ joinOutcome: Promise.reject(refusal) });

    await act(async () => result.current.notify({ vendor: "nvidia", model: "h100", gpuCount: 1 }, "no_fit"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    render(enqueueSnackbar.mock.calls[0][0]);
    expect(screen.getByText("You can only wait on 10 pools at once")).toBeInTheDocument();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("reports a setup as waiting once the list holds a matching entry", async () => {
    const { result } = setup({ entries: [WAITING_ENTRY] });

    await waitFor(() => expect(result.current.isWaiting({ vendor: "nvidia", model: "H100" })).toBe(true));
    expect(result.current.findEntry({ vendor: "nvidia", model: "h100" })?.placeInLine).toBe(4);
    expect(result.current.isWaiting({ vendor: "nvidia", model: "a100" })).toBe(false);
  });

  it("queries the waitlist while the flag is on and a user is signed in", async () => {
    const { listGpuWaitlist } = setup({ entries: [WAITING_ENTRY] });

    await waitFor(() => expect(listGpuWaitlist).toHaveBeenCalledOnce());
  });

  it("does not query the waitlist while the flag is off", async () => {
    const { listGpuWaitlist, result } = setup({ entries: [WAITING_ENTRY], isFlagOn: false });

    await act(() => new Promise(resolve => setTimeout(resolve, 20)));

    expect(listGpuWaitlist).not.toHaveBeenCalled();
    expect(result.current.isEnabled).toBe(false);
  });

  it("does not query the waitlist while signed out", async () => {
    const { listGpuWaitlist, result } = setup({ entries: [WAITING_ENTRY], isSignedIn: false });

    await act(() => new Promise(resolve => setTimeout(resolve, 20)));

    expect(listGpuWaitlist).not.toHaveBeenCalled();
    expect(result.current.isEnabled).toBe(false);
  });

  function setup(input: { entries?: unknown[]; joinOutcome?: Promise<unknown>; isFlagOn?: boolean; isSignedIn?: boolean }) {
    input.joinOutcome?.catch(() => undefined);
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const listGpuWaitlist = vi.fn().mockResolvedValue({ data: input.entries ?? [] });
    const joinGpuWaitlist = vi.fn(() => input.joinOutcome ?? Promise.resolve({ data: WAITING_ENTRY }));
    const api = createProxy({ v1: { listGpuWaitlist, joinGpuWaitlist } }) as unknown as ApiService;
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useFlag: () => input.isFlagOn ?? true,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : { id: "me" } }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    const { result } = setupQuery(() => useNotifyMe(dependencies), {
      services: {
        api: () => api,
        queryClient: () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
        analyticsService: () => analyticsService
      }
    });

    return { result, listGpuWaitlist, joinGpuWaitlist, enqueueSnackbar, analyticsService };
  }
});
