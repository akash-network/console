import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BrowserEnvConfig } from "@src/config/browser-env.config";
import type { TrialGpuAvailability } from "@src/types/gpu";
import { useTrialRunnableModels } from "./useTrialRunnableModels";

import { setupQuery } from "@tests/unit/query-client";

describe(useTrialRunnableModels.name, () => {
  it("is checking until the availability answers", () => {
    const { result } = setup({ availability: new Promise(() => {}) });

    expect(result.current).toEqual({ models: [], isChecking: true, hasCheckFailed: false });
  });

  it("answers the models whose gpu has free units", async () => {
    const { result } = setup({ availability: Promise.resolve([{ vendor: "nvidia", model: "v100", freeUnits: 8 }]) });

    await vi.waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.models.map(({ template, freeUnits }) => [template.name, freeUnits])).toEqual([["Gemma 3 4B", 8]]);
  });

  it("answers no models when no trial gpu is free", async () => {
    const { result } = setup({ availability: Promise.resolve([]) });

    await vi.waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.models).toEqual([]);
    expect(result.current.hasCheckFailed).toBe(false);
  });

  it("answers no models and reports the failure when the availability check fails", async () => {
    const { result } = setup({ availability: Promise.reject(new Error("Internal Server Error")) });

    await vi.waitFor(() => expect(result.current.hasCheckFailed).toBe(true));
    expect(result.current.models).toEqual([]);
  });

  it("leaves out models that exceed the configured trial limits", async () => {
    const { result } = setup({ availability: Promise.resolve([{ vendor: "nvidia", model: "v100", freeUnits: 8 }]), maxMemoryGi: 8 });

    await vi.waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.models).toEqual([]);
  });

  function setup(input: { availability: Promise<TrialGpuAvailability[]>; maxMemoryGi?: number }) {
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockReturnValue(input.availability.then(data => ({ data: { data } })) as ReturnType<AxiosInstance["get"]>);

    return setupQuery(() => useTrialRunnableModels(), {
      services: {
        publicConsoleApiHttpClient: () => httpClient,
        publicConfig: () =>
          mock<BrowserEnvConfig>({
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU: 4,
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: input.maxMemoryGi ?? 16,
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: ["nvidia/h100"]
          })
      }
    });
  }
});
