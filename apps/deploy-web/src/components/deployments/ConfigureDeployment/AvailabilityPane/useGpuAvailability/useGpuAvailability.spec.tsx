import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { KeyedScreeningRequest, ScreeningRequest } from "@src/queries/useScreenedProviders";
import { SCREENING_DEBOUNCE_MS } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { GPU_INTERCONNECT_CAPABILITY_KEY } from "@src/utils/sdl/gpuInterconnect";
import type { DEPENDENCIES } from "./useGpuAvailability";
import { useGpuAvailability } from "./useGpuAvailability";

import { act, renderHook } from "@testing-library/react";

const NO_GPU = "no-gpu";

describe(useGpuAvailability.name, () => {
  it("counts each other model by screening the configuration with only the model switched", () => {
    const { result, screenedRequests, screenedKeys } = setup({ gpuModel: "h100", interconnect: true, screened: { a100: 2, t4: 0, [NO_GPU]: 25 } });

    expect(result.current.requestedLabel).toBe("H100");
    expect(result.current.alternatives).toEqual([{ key: "nvidia/a100", label: "A100", providerCount: 2 }]);
    expect(result.current.noOtherModelFits).toBe(false);
    expect(screenedRequests().map(modelOf)).toEqual(["a100", "t4", NO_GPU]);
    expect(screenedKeys()).toEqual(["nvidia/a100", "nvidia/t4", "no-gpu"]);
    expect(screenedRequests().every(request => request.requirements?.attributes?.some(attribute => attribute.key === GPU_INTERCONNECT_CAPABILITY_KEY))).toBe(
      true
    );
  });

  it("counts no gpu by screening the configuration with the gpu turned off", () => {
    const { result } = setup({ gpuModel: "h100", screened: { a100: 2, t4: 1, [NO_GPU]: 25 } });

    expect(result.current.noGpuCount).toBe(25);
  });

  it("screens a gpu for each model and no gpu variant while the placement asks for no gpu", () => {
    const { result, screenedRequests } = setup({ screened: { a100: 3, h100: 1, t4: 2 } });

    expect(result.current.requestedLabel).toBe("No GPU");
    expect(result.current.noGpuCount).toBeNull();
    expect(result.current.alternatives.map(model => model.key)).toEqual(["nvidia/a100", "nvidia/t4", "nvidia/h100"]);
    expect(screenedRequests().map(modelOf)).toEqual(["a100", "h100", "t4"]);
  });

  it("reports the check in progress while any variant is still being screened", () => {
    const { result } = setup({ gpuModel: "h100", screened: { a100: 0, t4: 0, [NO_GPU]: 25 }, loading: ["t4"] });

    expect(result.current.isChecking).toBe(true);
    expect(result.current.noOtherModelFits).toBe(false);
  });

  it("reports that no other model fits once every variant has been screened", () => {
    const { result } = setup({ gpuModel: "h100", interconnect: true, screened: { a100: 0, t4: 0, [NO_GPU]: 25 } });

    expect(result.current.isChecking).toBe(false);
    expect(result.current.noOtherModelFits).toBe(true);
  });

  it("reports nothing about other models while the placement options are unavailable", () => {
    const { result, screenedRequests } = setup({ gpuModel: "h100", withoutOptions: true, screened: { [NO_GPU]: 25 } });

    expect(result.current.alternatives).toEqual([]);
    expect(result.current.noOtherModelFits).toBe(false);
    expect(screenedRequests().map(modelOf)).toEqual([NO_GPU]);
  });

  it("screens a changed configuration once the edits settle", () => {
    vi.useFakeTimers();
    try {
      const { form, screenedRequests } = setup({ gpuModel: "h100", screened: { a100: 2, t4: 1, [NO_GPU]: 25 } });

      act(() => form().setValue("services.0.profile.gpuModels.0.name", "t4"));
      expect(screenedRequests().map(modelOf)).toEqual(["a100", "t4", NO_GPU]);

      act(() => vi.advanceTimersByTime(SCREENING_DEBOUNCE_MS));
      expect(screenedRequests().map(modelOf)).toEqual(["a100", "h100", NO_GPU]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts every variant within the placement's picked regions", () => {
    const { screenedRegions } = setup({ gpuModel: "h100", regions: ["eu-west", "na-us-west"], screened: { a100: 2, t4: 1, [NO_GPU]: 25 } });

    expect(screenedRegions()).toEqual([
      ["eu-west", "na-us-west"],
      ["eu-west", "na-us-west"],
      ["eu-west", "na-us-west"]
    ]);
  });

  function setup(input: {
    gpuModel?: string;
    interconnect?: boolean;
    withoutOptions?: boolean;
    screened: Record<string, number>;
    loading?: string[];
    regions?: string[];
  }) {
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
        input.gpuModel
          ? {
              ...service,
              profile: {
                ...service.profile,
                hasGpu: true,
                gpu: 1,
                gpuModels: [{ vendor: "nvidia", name: input.gpuModel }],
                ...(input.interconnect ? { interconnect: {} } : {})
              }
            }
          : service
      ]
    };
    const placementOptions: PlacementOptions = {
      regions: [],
      regionProviderCounts: {},
      gpus: [
        {
          vendor: "nvidia",
          models: [
            { name: "h100", memory: [], interface: [], providerCount: 3, availableUnits: 3, maxNodeFreeUnits: 1, variants: [] },
            { name: "t4", memory: [], interface: [], providerCount: 7, availableUnits: 7, maxNodeFreeUnits: 1, variants: [] },
            { name: "a100", memory: [], interface: [], providerCount: 4, availableUnits: 4, maxNodeFreeUnits: 1, variants: [] },
            { name: "v100", memory: [], interface: [], providerCount: 0, availableUnits: 0, maxNodeFreeUnits: 0, variants: [] }
          ]
        }
      ]
    };
    const catalog: GpuVendor[] = [
      {
        name: "nvidia",
        models: [
          { name: "h100", displayName: "H100", memory: [], interface: [] },
          { name: "a100", displayName: "A100", memory: [], interface: [] },
          { name: "t4", displayName: "T4", memory: [], interface: [] }
        ]
      }
    ];
    const useScreenedProviderCounts = vi.fn((requests: KeyedScreeningRequest[]) =>
      requests.map(({ request }) => {
        const model = request ? modelOf(request) : NO_GPU;
        return { count: input.screened[model] ?? null, isLoading: input.loading?.includes(model) ?? false };
      })
    );
    const dependencies: typeof DEPENDENCIES = {
      usePlacementOptions: () => mock<ReturnType<typeof DEPENDENCIES.usePlacementOptions>>({ data: input.withoutOptions ? undefined : placementOptions }),
      useGpuModels: () => mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>({ data: catalog }),
      useScreenedProviderCounts
    };
    let formMethods: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      formMethods = form;
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const view = renderHook(() => useGpuAvailability({ id: placement.id, name: placement.name, regions: placement.regions }, dependencies), {
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

function modelOf(request: ScreeningRequest): string {
  const modelAttribute = request.resources[0].resource.gpu.attributes?.find(attribute => attribute.key.startsWith("vendor/"));
  return modelAttribute?.key.split("/").at(-1) ?? NO_GPU;
}
