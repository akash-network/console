import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useConfidentialCompute } from "./useConfidentialCompute";

import { act, renderHook } from "@testing-library/react";

describe(useConfidentialCompute.name, () => {
  it.each([
    { tee: undefined, isEnabled: false },
    { tee: "cpu", isEnabled: true },
    { tee: "cpu-gpu", isEnabled: true }
  ] as const)("reads the $tee TEE as enabled: $isEnabled", ({ tee, isEnabled }) => {
    const { result } = setup({ params: tee ? { tee } : undefined });

    expect(result.current).toMatchObject({ tee, isEnabled });
  });

  it("turns cpu confidential compute on and leaves a service without GPUs alone", () => {
    const { result, getValues } = setup({ profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    act(() => result.current.setEnabled(true));

    expect(getValues().services[0].params?.tee).toBe("cpu");
    expect(getValues().services[0].profile).toMatchObject({ hasGpu: false, gpu: 0, gpuModels: [] });
    expect(result.current.isEnabled).toBe(true);
  });

  it("drops the params object when turning off leaves nothing behind", () => {
    const { result, getValues } = setup({ params: { tee: "cpu" } });

    act(() => result.current.setEnabled(false));

    expect(getValues().services[0].params).toBeUndefined();
    expect(result.current.isEnabled).toBe(false);
  });

  it("keeps the other params when turned on and off", () => {
    const { result, getValues } = setup({ params: { permissions: { read: ["logs"] } } });

    act(() => result.current.setEnabled(true));
    expect(getValues().services[0].params).toEqual({ permissions: { read: ["logs"] }, tee: "cpu" });

    act(() => result.current.setEnabled(false));
    expect(getValues().services[0].params).toEqual({ permissions: { read: ["logs"] } });
  });

  it("adds one GPU with a default model when cpu-gpu is chosen for a service without GPUs", () => {
    const { result, getValues } = setup({ params: { tee: "cpu" }, profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    act(() => result.current.setTee("cpu-gpu"));

    expect(getValues().services[0].params?.tee).toBe("cpu-gpu");
    expect(getValues().services[0].profile).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });
  });

  it("leaves the GPU alone when cpu is chosen", () => {
    const { result, getValues } = setup({ params: { tee: "cpu-gpu" }, profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    act(() => result.current.setTee("cpu"));

    expect(getValues().services[0].params?.tee).toBe("cpu");
    expect(getValues().services[0].profile).toMatchObject({ hasGpu: false, gpu: 0 });
  });

  it("ignores cpu-gpu while the trial blocks GPUs", () => {
    const { result, getValues } = setup({ params: { tee: "cpu" }, isGpuBlocked: true });

    act(() => result.current.setTee("cpu-gpu"));

    expect(getValues().services[0].params?.tee).toBe("cpu");
  });

  function setup(input: { params?: ServiceType["params"]; profile?: Partial<ServiceType["profile"]>; isGpuBlocked?: boolean }) {
    const base = defaultServiceWithPlacement({ params: input.params });
    const values: SdlBuilderFormValuesType = { ...base, services: [{ ...base.services[0], profile: { ...base.services[0].profile, ...input.profile } }] };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    const { result } = renderHook(() => useConfidentialCompute(0, { isGpuBlocked: input.isGpuBlocked }), { wrapper: Wrapper });

    return { result, getValues: () => getValues() };
  }
});
