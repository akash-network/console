import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, TrialGpuBlockHint } from "./TrialGpuBlockHint";

import { render } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

const BLOCKED_GPU_MODELS = ["nvidia/h100", "nvidia/a100"];

describe(TrialGpuBlockHint.name, () => {
  it("offers the alternatives for the configured template once the deployment asks for a gpu the trial blocks", () => {
    const { BlockedGpuAlternatives } = setup({ gpuModel: "h100", templateId: "akash-network-awesome-akash-Llama-3.3-70B" });

    expect(BlockedGpuAlternatives).toHaveBeenCalledWith({ templateId: "akash-network-awesome-akash-Llama-3.3-70B", placement: "configure" }, expect.anything());
  });

  it("offers the alternatives without a template for a deployment that started from its own sdl", () => {
    const { BlockedGpuAlternatives } = setup({ gpuModel: "a100" });

    expect(BlockedGpuAlternatives).toHaveBeenCalledWith({ templateId: undefined, placement: "configure" }, expect.anything());
  });

  it("stays out of the way of a gpu the trial can use", () => {
    const { BlockedGpuAlternatives } = setup({ gpuModel: "v100", templateId: "gemma-3-4b-v100" });

    expect(BlockedGpuAlternatives).not.toHaveBeenCalled();
  });

  it("stays out of the way of a deployment with no gpu", () => {
    const { BlockedGpuAlternatives } = setup({ gpuModel: "h100", hasGpu: false });

    expect(BlockedGpuAlternatives).not.toHaveBeenCalled();
  });

  it("keeps the configure page unchanged while onboarding_intent_first is off", () => {
    const { BlockedGpuAlternatives, useFlag } = setup({ gpuModel: "h100", isIntentFirst: false });

    expect(BlockedGpuAlternatives).not.toHaveBeenCalled();
    expect(useFlag).toHaveBeenCalledWith("onboarding_intent_first");
  });

  function setup(input: { gpuModel: string; hasGpu?: boolean; templateId?: string; isIntentFirst?: boolean }) {
    const base = defaultServiceWithPlacement();
    const service = base.services[0];
    const values: SdlBuilderFormValuesType = {
      placements: base.placements,
      services: [{ ...service, profile: { ...service.profile, hasGpu: input.hasGpu ?? true, gpuModels: [{ vendor: "nvidia", name: input.gpuModel }] } }],
      endpoints: []
    };
    const BlockedGpuAlternatives = vi.fn(ComponentMock);
    const useFlag = vi.fn(() => input.isIntentFirst ?? true);
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: mock<ReturnType<typeof DEPENDENCIES.useServices>["publicConfig"]>({
          NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: BLOCKED_GPU_MODELS
        })
      });
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () =>
      new URLSearchParams(input.templateId ? { templateId: input.templateId } : {}) as ReadonlyURLSearchParams;
    const dependencies = MockComponents(DEPENDENCIES, { BlockedGpuAlternatives, useFlag, useServices, useSearchParams });
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    render(<TrialGpuBlockHint dependencies={dependencies} />, { wrapper: Wrapper });

    return { BlockedGpuAlternatives, useFlag };
  }
});
