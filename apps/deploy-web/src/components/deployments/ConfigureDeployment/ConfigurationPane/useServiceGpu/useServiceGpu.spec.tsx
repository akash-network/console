import type { PropsWithChildren } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useServiceGpu } from "./useServiceGpu";

import { act, renderHook } from "@testing-library/react";

type GpuProfile = Pick<SdlBuilderFormValuesType["services"][number]["profile"], "hasGpu" | "gpu" | "gpuModels">;

describe(useServiceGpu.name, () => {
  it("reads no units while the GPU is off even when a count is stored", () => {
    const { result } = setup({ hasGpu: false, gpu: 1, gpuModels: [{ vendor: "nvidia" }] });

    expect(result.current.gpu.count).toBe(0);
  });

  it("reads the stored count while the GPU is on", () => {
    const { result } = setup({ hasGpu: true, gpu: 3, gpuModels: [{ vendor: "nvidia", name: "h100" }] });

    expect(result.current.gpu.count).toBe(3);
  });

  it("turns the GPU on with a default model when counting up from zero", () => {
    const { result, profile } = setup({ hasGpu: false, gpu: 0, gpuModels: [] });

    act(() => result.current.gpu.setCount(1));

    expect(profile()).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });
    expect(result.current.gpu.count).toBe(1);
  });

  it("keeps the models a switched-off GPU still carries when counting up", () => {
    const { result, profile } = setup({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "h100" }] });

    act(() => result.current.gpu.setCount(2));

    expect(profile()).toMatchObject({ hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "h100" }] });
  });

  it("changes only the count while the GPU is on", () => {
    const { result, profile } = setup({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "h100" }] });

    act(() => result.current.gpu.setCount(4));

    expect(profile()).toMatchObject({ hasGpu: true, gpu: 4, gpuModels: [{ vendor: "nvidia", name: "h100" }] });
  });

  it("turns the GPU off at zero and keeps its models for a later count", () => {
    const { result, profile } = setup({ hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "h100" }] });

    act(() => result.current.gpu.setCount(0));

    expect(profile()).toMatchObject({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "h100" }] });
    expect(result.current.gpu.count).toBe(0);
  });

  it("enables a switched-off GPU with one unit and a default model", () => {
    const { result, profile } = setup({ hasGpu: false, gpu: 0, gpuModels: [] });

    act(() => result.current.gpu.enable());

    expect(profile()).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });
  });

  it("leaves an enabled GPU's count and models alone when enabled again", () => {
    const { result, profile } = setup({ hasGpu: true, gpu: 3, gpuModels: [{ vendor: "nvidia", name: "a100" }] });

    act(() => result.current.gpu.enable());

    expect(profile()).toMatchObject({ hasGpu: true, gpu: 3, gpuModels: [{ vendor: "nvidia", name: "a100" }] });
  });

  it("writes the first model and turns the GPU on when a model is picked before any entry exists", () => {
    const { result, profile } = setup({ hasGpu: false, gpu: 0, gpuModels: [] });

    act(() => result.current.gpu.pickFirstModel("h100"));

    expect(profile()).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }] });
  });

  function setup(input: GpuProfile) {
    const base = defaultServiceWithPlacement();
    const values: SdlBuilderFormValuesType = {
      ...base,
      services: [{ ...base.services[0], profile: { ...base.services[0].profile, ...input } }]
    };
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const rendered = renderHook(() => ({ gpu: useServiceGpu(0), form: useFormContext<SdlBuilderFormValuesType>() }), { wrapper: Wrapper });

    return { ...rendered, profile: () => rendered.result.current.form.getValues("services.0.profile") };
  }
});
