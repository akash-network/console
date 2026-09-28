import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./useGpuAvailability";
import { useGpuAvailability } from "./useGpuAvailability";

import { renderHook } from "@testing-library/react";

describe(useGpuAvailability.name, () => {
  it("labels the placement's GPU request and lists the busiest other models", () => {
    const { result } = setup({ gpuModel: "h100" });

    expect(result.current).toEqual({
      requestedLabel: "H100",
      topModels: [{ key: "nvidia/rtx4090", label: "RTX 4090", providerCount: 7 }]
    });
  });

  it("labels a placement without GPUs", () => {
    const { result } = setup({});

    expect(result.current.requestedLabel).toBe("No GPU");
    expect(result.current.topModels.map(model => model.key)).toEqual(["nvidia/rtx4090", "nvidia/h100"]);
  });

  it("lists no models while the placement options are unavailable", () => {
    const { result } = setup({ withoutOptions: true });

    expect(result.current.topModels).toEqual([]);
  });

  function setup(input: { gpuModel?: string; withoutOptions?: boolean }) {
    const placement = defaultPlacement({ name: "placement-1" });
    const service = defaultService(placement.id, { image: "nginx" });
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      endpoints: [],
      services: [
        input.gpuModel
          ? { ...service, profile: { ...service.profile, hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: input.gpuModel }] } }
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
            { name: "h100", memory: [], interface: [], providerCount: 3, variants: [] },
            { name: "rtx4090", memory: [], interface: [], providerCount: 7, variants: [] }
          ]
        }
      ]
    };
    const catalog: GpuVendor[] = [
      {
        name: "nvidia",
        models: [
          { name: "h100", displayName: "H100", memory: [], interface: [] },
          { name: "rtx4090", displayName: "RTX 4090", memory: [], interface: [] }
        ]
      }
    ];
    const dependencies: typeof DEPENDENCIES = {
      usePlacementOptions: () => mock<ReturnType<typeof DEPENDENCIES.usePlacementOptions>>({ data: input.withoutOptions ? undefined : placementOptions }),
      useGpuModels: () => mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>({ data: catalog })
    };
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    return renderHook(() => useGpuAvailability(placement.id, dependencies), { wrapper: Wrapper });
  }
});
