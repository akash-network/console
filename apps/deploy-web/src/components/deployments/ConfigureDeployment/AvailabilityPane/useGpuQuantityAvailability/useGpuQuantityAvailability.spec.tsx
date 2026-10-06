import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { KeyedScreeningRequest, ScreeningRequest } from "@src/queries/useScreenedProviders";
import { SCREENING_DEBOUNCE_MS } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { GPU_INTERCONNECT_CAPABILITY_KEY } from "@src/utils/sdl/gpuInterconnect";
import type { DEPENDENCIES } from "./useGpuQuantityAvailability";
import { useGpuQuantityAvailability } from "./useGpuQuantityAvailability";

import { act, renderHook } from "@testing-library/react";

describe(useGpuQuantityAvailability.name, () => {
  it("counts the providers at each quantity by screening the configuration with only the gpu count changed", () => {
    const { result, screenedRequests, screenedKeys } = setup({ gpu: 2, gpuModel: "h100", interconnect: true, screened: { 1: 9, 2: 6, 4: 3, 8: 0 } });

    expect(result.current).toEqual([
      { gpuCount: 1, providerCount: 9, isCurrent: false },
      { gpuCount: 2, providerCount: 6, isCurrent: true },
      { gpuCount: 4, providerCount: 3, isCurrent: false },
      { gpuCount: 8, providerCount: 0, isCurrent: false }
    ]);
    expect(screenedKeys()).toEqual(["1", "2", "4", "8"]);
    expect(screenedRequests().map(unitsOf)).toEqual([1, 2, 4, 8]);
    expect(screenedRequests().map(modelOf)).toEqual(["h100", "h100", "h100", "h100"]);
    expect(screenedRequests().every(request => request.requirements?.attributes?.some(attribute => attribute.key === GPU_INTERCONNECT_CAPABILITY_KEY))).toBe(
      true
    );
  });

  it("marks no quantity as current while the configured count is off the ladder", () => {
    const { result } = setup({ gpu: 3, gpuModel: "h100", screened: { 1: 9, 2: 6, 4: 3, 8: 0 } });

    expect(result.current.some(quantity => quantity.isCurrent)).toBe(false);
  });

  it("leaves a quantity's count unknown until its screening answers", () => {
    const { result } = setup({ gpu: 1, gpuModel: "h100", screened: { 1: 9, 2: 6 } });

    expect(result.current.map(quantity => quantity.providerCount)).toEqual([9, 6, null, null]);
  });

  it("screens nothing while the placement asks for no gpu", () => {
    const { result, screenedKeys } = setup({ screened: { 1: 9 } });

    expect(result.current).toEqual([]);
    expect(screenedKeys()).toEqual([]);
  });

  it("screens a changed configuration once the edits settle", () => {
    vi.useFakeTimers();
    try {
      const { form, result, screenedRequests } = setup({ gpu: 1, gpuModel: "h100", screened: { 1: 9, 2: 6, 4: 3, 8: 0 } });

      act(() => form().setValue("services.0.profile.gpuModels.0.name", "a100"));
      act(() => form().setValue("services.0.profile.gpu", 4));
      expect(screenedRequests().map(modelOf)).toEqual(["h100", "h100", "h100", "h100"]);

      act(() => vi.advanceTimersByTime(SCREENING_DEBOUNCE_MS));
      expect(screenedRequests().map(modelOf)).toEqual(["a100", "a100", "a100", "a100"]);
      expect(result.current.map(quantity => quantity.isCurrent)).toEqual([false, false, true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts every quantity within the placement's picked regions", () => {
    const { screenedRegions } = setup({ gpu: 1, gpuModel: "h100", regions: ["eu-west", "na-us-west"], screened: { 1: 9, 2: 6, 4: 3, 8: 0 } });

    expect(screenedRegions()).toEqual(Array.from({ length: 4 }, () => ["eu-west", "na-us-west"]));
  });

  function setup(input: { gpu?: number; gpuModel?: string; interconnect?: boolean; regions?: string[]; screened: Record<number, number> }) {
    const placement = defaultPlacement({
      name: "placement-1",
      regions: input.regions,
      attributes: input.interconnect ? [{ id: "a1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }] : []
    });
    const service = defaultService(placement.id, { image: "nginx" });
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      endpoints: [],
      services: [
        input.gpu
          ? {
              ...service,
              profile: {
                ...service.profile,
                hasGpu: true,
                gpu: input.gpu,
                gpuModels: [{ vendor: "nvidia", name: input.gpuModel ?? "" }],
                ...(input.interconnect ? { interconnect: {} } : {})
              }
            }
          : service
      ]
    };
    const useScreenedProviderCounts = vi.fn((requests: KeyedScreeningRequest[]) =>
      requests.map(({ request }) => ({ count: request ? input.screened[unitsOf(request)] ?? null : null, gpuCount: null, isLoading: false }))
    );
    const dependencies: typeof DEPENDENCIES = { useScreenedProviderCounts };
    let formMethods: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      formMethods = form;
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const view = renderHook(() => useGpuQuantityAvailability({ id: placement.id, name: placement.name, regions: placement.regions }, dependencies), {
      wrapper: Wrapper
    });

    return {
      result: view.result,
      form: () => formMethods!,
      screenedKeys: () => (useScreenedProviderCounts.mock.lastCall?.[0] ?? []).map(({ key }) => key),
      screenedRegions: () => (useScreenedProviderCounts.mock.lastCall?.[0] ?? []).map(({ regions }) => regions),
      screenedRequests: () =>
        (useScreenedProviderCounts.mock.lastCall?.[0] ?? []).map(({ request }) => request).filter((request): request is ScreeningRequest => request !== null)
    };
  }
});

function unitsOf(request: ScreeningRequest): number {
  return Number(request.resources[0].resource.gpu.units?.val);
}

function modelOf(request: ScreeningRequest): string | undefined {
  const modelAttribute = request.resources[0].resource.gpu.attributes?.find(attribute => attribute.key.startsWith("vendor/"));
  return modelAttribute?.key.split("/").at(-1);
}
