import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderGpuInventory } from "@src/types/gpu";
import { ApiUrlService } from "@src/utils/apiUtils";
import { useProviderGpus, useTrialGpuAvailability } from "./useGpuQuery";

import { setupQuery } from "@tests/unit/query-client";

describe(useProviderGpus.name, () => {
  it("answers the provider's GPU inventory", async () => {
    const inventory = mock<ProviderGpuInventory>();
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockResolvedValue({ data: inventory });

    const { result } = setupQuery(() => useProviderGpus("akash1provider"), { services: { publicConsoleApiHttpClient: () => httpClient } });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(inventory);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(ApiUrlService.providerGpus("akash1provider"));
  });
});

describe(useTrialGpuAvailability.name, () => {
  it("answers the trial gpu models with free units", async () => {
    const availability = [{ vendor: "nvidia", model: "v100", freeUnits: 8 }];
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockResolvedValue({ data: { data: availability } });

    const { result } = setupQuery(() => useTrialGpuAvailability(), { services: { publicConsoleApiHttpClient: () => httpClient } });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(availability);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(ApiUrlService.trialGpuAvailability());
  });
});
