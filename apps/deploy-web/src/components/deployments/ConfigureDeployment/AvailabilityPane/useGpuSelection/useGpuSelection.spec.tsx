import type { PropsWithChildren } from "react";
import { FormProvider, useForm, useFormContext, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./useGpuSelection";
import { useGpuSelection } from "./useGpuSelection";

import { act, renderHook } from "@testing-library/react";

type Service = SdlBuilderFormValuesType["services"][number];

describe(useGpuSelection.name, () => {
  it("switches the placement's gpu service to the picked model with its memory and interface unpinned and its count kept", () => {
    const { result, profile, dirtyFields, analyticsService } = setup({
      services: [gpuService("web", "p1", 2, { vendor: "nvidia", name: "h100", memory: "80Gi", interface: "sxm" })]
    });

    act(() => result.current.selection.select({ kind: "model", vendor: "nvidia", name: "a100" }));

    expect(profile(0)).toMatchObject({ hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }] });
    expect(dirtyFields(0)).toEqual({ gpuModels: true });
    expect(analyticsService.track).toHaveBeenCalledWith("configure_gpu_type_selected", {
      category: "deployments",
      model: "a100",
      vendor: "nvidia",
      source: "availability_pane"
    });
  });

  it("adds one gpu of the picked model to the placement's first service while none asks for a gpu", () => {
    const { result, profile, dirtyFields } = setup({
      services: [defaultService("p2", { title: "other" }), defaultService("p1", { title: "web" }), defaultService("p1", { title: "api" })]
    });

    act(() => result.current.selection.select({ kind: "model", vendor: "nvidia", name: "t4" }));

    expect(profile(1)).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "t4" }] });
    expect(dirtyFields(1)).toEqual({ hasGpu: true, gpuModels: true });
    expect(profile(0).hasGpu).toBe(false);
    expect(profile(2).hasGpu).toBe(false);
  });

  it("turns off every gpu of the placement when no gpu is picked", () => {
    const { result, profile, dirtyFields, analyticsService } = setup({
      services: [gpuService("web", "p1", 2, { vendor: "nvidia", name: "h100" }), gpuService("other", "p2", 1, { vendor: "nvidia", name: "t4" })]
    });

    act(() => result.current.selection.select({ kind: "no-gpu" }));

    expect(profile(0)).toMatchObject({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "h100" }] });
    expect(dirtyFields(0)).toEqual({ hasGpu: true, gpu: true });
    expect(profile(1)).toMatchObject({ hasGpu: true, gpu: 1 });
    expect(analyticsService.track).toHaveBeenCalledWith("configure_gpu_count_changed", { category: "deployments", count: 0, source: "availability_pane" });
  });

  it("sets the count of the placement's gpu service", () => {
    const { result, profile, dirtyFields, analyticsService } = setup({ services: [gpuService("web", "p1", 1, { vendor: "nvidia", name: "h100" })] });

    act(() => result.current.selection.selectGpuCount(4));

    expect(profile(0)).toMatchObject({ hasGpu: true, gpu: 4, gpuModels: [{ vendor: "nvidia", name: "h100" }] });
    expect(dirtyFields(0)).toEqual({ gpu: true });
    expect(analyticsService.track).toHaveBeenCalledWith("configure_gpu_count_changed", { category: "deployments", count: 4, source: "availability_pane" });
  });

  it("clears a stale count error once it writes a valid count", async () => {
    const { result, form } = setup({ services: [gpuService("web", "p1", 1, { vendor: "nvidia", name: "h100" })] });
    act(() => form().setError("services.0.profile.gpu", { type: "manual", message: "Too many GPUs" }));

    act(() => result.current.selection.selectGpuCount(2));

    await vi.waitFor(() => expect(form().getFieldState("services.0.profile.gpu").error).toBeUndefined());
  });

  it("refuses a model the trial blocks and leaves the form alone", () => {
    const { result, profile, analyticsService } = setup({ isRestricted: true, services: [gpuService("web", "p1", 1, { vendor: "nvidia", name: "t4" })] });
    const blocked = { kind: "model" as const, vendor: "nvidia", name: "h100" };

    expect(result.current.selection.canSelect(blocked)).toBe(false);
    act(() => result.current.selection.select(blocked));

    expect(profile(0).gpuModels).toEqual([expect.objectContaining({ name: "t4" })]);
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("lets a trial pick a model it allows and no gpu", () => {
    const { result } = setup({ isRestricted: true, services: [] });

    expect(result.current.selection.canSelect({ kind: "model", vendor: "nvidia", name: "t4" })).toBe(true);
    expect(result.current.selection.canSelect({ kind: "no-gpu" })).toBe(true);
  });

  it("lets a paying user pick any model", () => {
    const { result } = setup({ isRestricted: false, services: [] });

    expect(result.current.selection.canSelect({ kind: "model", vendor: "nvidia", name: "h100" })).toBe(true);
  });

  function setup(input: { services: Service[]; isRestricted?: boolean }) {
    const values: SdlBuilderFormValuesType = {
      services: input.services,
      placements: [
        { ...defaultPlacement({ name: "dcloud" }), id: "p1" },
        { ...defaultPlacement({ name: "other" }), id: "p2" }
      ],
      endpoints: []
    };
    const analyticsService = mock<AnalyticsService>();
    const dependencies: typeof DEPENDENCIES = {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useTrialGate: vi.fn(() => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true }))
    };
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, resolver: zodResolver(SdlBuilderFormValuesSchema) });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const rendered = renderHook(
      () => ({
        selection: useGpuSelection("p1", dependencies),
        form: useFormContext<SdlBuilderFormValuesType>(),
        dirtyFields: useFormState<SdlBuilderFormValuesType>().dirtyFields
      }),
      { wrapper: Wrapper }
    );

    return {
      ...rendered,
      analyticsService,
      form: () => rendered.result.current.form,
      profile: (index: number) => rendered.result.current.form.getValues(`services.${index}.profile`),
      dirtyFields: (index: number) => rendered.result.current.dirtyFields.services?.[index]?.profile
    };
  }
});

function gpuService(title: string, placementId: string, gpu: number, model: Partial<NonNullable<Service["profile"]["gpuModels"]>[number]>): Service {
  const service = defaultService(placementId, { title });
  return {
    ...service,
    profile: { ...service.profile, hasGpu: true, gpu, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "", ...model }] }
  };
}
