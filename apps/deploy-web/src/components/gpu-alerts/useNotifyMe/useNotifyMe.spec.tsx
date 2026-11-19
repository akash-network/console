import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DEPENDENCIES, useNotifyMe } from "./useNotifyMe";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const WAITING_ENTRY = { id: "entry-1", vendor: "nvidia", model: "h100", memory: null, interface: null, gpuCount: 2, placeInLine: 4 };

describe(useNotifyMe.name, () => {
  it("joins the waitlist and confirms the place in line", async () => {
    const { result, joinGpuWaitlist, enqueueSnackbar, analyticsService } = setup({
      joinOutcome: Promise.resolve({ data: { ...WAITING_ENTRY, placeInLine: 7 } })
    });

    await act(async () => result.current.notify({ vendor: "nvidia", model: "h100", gpuCount: 2, label: "NVIDIA H100" }, "gpu_menu"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(joinGpuWaitlist).toHaveBeenCalledWith({
      data: { vendor: "nvidia", model: "h100", memory: undefined, interface: undefined, gpuCount: 2, source: "gpu_menu" }
    });
    expect(JSON.stringify(enqueueSnackbar.mock.calls[0][0])).toContain("You're #7 in line for NVIDIA H100");
    expect(analyticsService.track).toHaveBeenCalledWith("gpu_alert_joined", expect.objectContaining({ source: "gpu_menu" }));
  });

  it("shows the API message when joining is refused", async () => {
    const refusal = new ApiError(409, { message: "You can only wait on 10 pools at once" }, "POST /v1/gpu-waitlist → 409");
    const { result, enqueueSnackbar, analyticsService } = setup({ joinOutcome: Promise.reject(refusal) });

    await act(async () => result.current.notify({ vendor: "nvidia", model: "h100", gpuCount: 1 }, "no_fit"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(JSON.stringify(enqueueSnackbar.mock.calls[0][0])).toContain("You can only wait on 10 pools at once");
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("reports a setup as waiting once the list holds a matching entry", async () => {
    const { result } = setup({ entries: [WAITING_ENTRY] });

    await waitFor(() => expect(result.current.isWaiting({ vendor: "nvidia", model: "H100" })).toBe(true));
    expect(result.current.findEntry({ vendor: "nvidia", model: "h100" })?.placeInLine).toBe(4);
    expect(result.current.isWaiting({ vendor: "nvidia", model: "a100" })).toBe(false);
  });

  it("does not query the waitlist while the flag is off", () => {
    const { listGpuWaitlist, result } = setup({ entries: [WAITING_ENTRY], isFlagOn: false });

    expect(listGpuWaitlist).not.toHaveBeenCalled();
    expect(result.current.isEnabled).toBe(false);
  });

  it("does not query the waitlist while signed out", () => {
    const { listGpuWaitlist, result } = setup({ entries: [WAITING_ENTRY], isSignedIn: false });

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
