import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ConfidentialComputeCard, DEPENDENCIES } from "./ConfidentialComputeCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ConfidentialComputeCard.name, () => {
  it("hides the body and leaves the switch off when no TEE is set", () => {
    setup({});

    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).not.toBeChecked();
    expect(screen.queryByRole("radiogroup", { name: "Confidential compute type" })).not.toBeInTheDocument();
  });

  it("sets the TEE to cpu and reveals the radios when toggled on", async () => {
    const { getValues } = setup({});

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[0].params?.tee).toBe("cpu");
    expect(screen.getByRole("radio", { name: "CPU" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).not.toBeChecked();
  });

  it("clears the TEE param when toggled off", async () => {
    const { getValues } = setup({ tee: "cpu" });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[0].params?.tee).toBeUndefined();
    expect(screen.queryByRole("radiogroup", { name: "Confidential compute type" })).not.toBeInTheDocument();
  });

  it("switches the TEE to cpu-gpu when that radio is chosen", async () => {
    const { getValues } = setup({ tee: "cpu" });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    expect(getValues().services[0].params?.tee).toBe("cpu-gpu");
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeChecked();
  });

  it("reflects an initial cpu-gpu value", () => {
    setup({ tee: "cpu-gpu" });

    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeChecked();
  });

  it("enables GPU when cpu-gpu is chosen so the attested GPU is backed by resources", async () => {
    const { getValues } = setup({ tee: "cpu", profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    const profile = getValues().services[0].profile;
    expect(profile.hasGpu).toBe(true);
    expect(profile.gpu).toBeGreaterThanOrEqual(1);
    expect((profile.gpuModels ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("preserves an already-configured GPU instead of resetting it when cpu-gpu is chosen", async () => {
    const { getValues } = setup({ tee: "cpu", profile: { hasGpu: true, gpu: 4, gpuModels: [{ vendor: "nvidia", name: "h100" }] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    const profile = getValues().services[0].profile;
    expect(profile.gpu).toBe(4);
    expect(profile.gpuModels).toEqual([{ vendor: "nvidia", name: "h100" }]);
  });

  it("leaves GPU untouched when cpu is chosen", async () => {
    const { getValues } = setup({ tee: "cpu-gpu", profile: { hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia" }] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU" }));

    expect(getValues().services[0].profile.hasGpu).toBe(true);
    expect(getValues().services[0].profile.gpu).toBe(2);
  });

  it("preserves other params when the TEE is toggled on and off", async () => {
    const { getValues } = setup({ params: { permissions: { read: ["logs"] } } });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));
    expect(getValues().services[0].params).toMatchObject({ permissions: { read: ["logs"] }, tee: "cpu" });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));
    expect(getValues().services[0].params).toMatchObject({ permissions: { read: ["logs"] } });
    expect(getValues().services[0].params?.tee).toBeUndefined();
  });

  it("drops the params object entirely when toggling off leaves nothing behind", async () => {
    const { getValues } = setup({ tee: "cpu" });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[0].params).toBeUndefined();
  });

  it("disables the switch and radios while the pane is locked", () => {
    setup({ tee: "cpu", locked: true });

    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "CPU" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeDisabled();
  });

  it("shows an off-state hint instead of radios when opened while off and locked", async () => {
    setup({ locked: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand Confidential Compute" }));

    expect(screen.getByText("Confidential compute is off.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Confidential compute type" })).not.toBeInTheDocument();
  });

  it("previews the attestation-sidecar resource carve-out when enabled", () => {
    setup({ tee: "cpu" });

    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("Attestation sidecar")).toBeInTheDocument();
    expect(screen.getByText("Available to your container")).toBeInTheDocument();
  });

  it("hides the resource carve-out while confidential compute is off", () => {
    setup({});

    expect(screen.queryByText("Attestation sidecar")).not.toBeInTheDocument();
  });

  it("warns when cpu-gpu is selected but the service has no GPU resources", () => {
    setup({ tee: "cpu-gpu", profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    expect(screen.getByText(/needs GPU resources/i)).toBeInTheDocument();
  });

  it("does not warn when cpu-gpu is selected and GPU was enabled by the selection", async () => {
    const { getValues } = setup({ tee: "cpu", profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    const profile = getValues().services[0].profile;
    expect(profile.hasGpu).toBe(true);
    expect(profile.gpu).toBeGreaterThanOrEqual(1);
    expect((profile.gpuModels ?? []).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/needs GPU resources/i)).not.toBeInTheDocument();
  });

  describe("when GPU is blocked for the trial", () => {
    it("locks the CPU-GPU option while keeping CPU selectable", () => {
      setup({ tee: "cpu", isGpuBlocked: true });

      expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "CPU" })).not.toBeDisabled();
    });

    it("shows the free-trial warning with an unlock CTA", () => {
      setup({ tee: "cpu", isGpuBlocked: true });

      expect(screen.getByText(/high-end GPUs aren't available on a free trial/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Unlock high-end GPUs" })).toBeInTheDocument();
    });

    it("opens the unlock sheet when the unlock CTA is clicked", async () => {
      const onUnlock = vi.fn();
      setup({ tee: "cpu", isGpuBlocked: true, onUnlock });

      await userEvent.click(screen.getByRole("button", { name: "Unlock high-end GPUs" }));

      expect(onUnlock).toHaveBeenCalledTimes(1);
    });

    it("ignores a cpu-gpu selection defensively even if the disabled radio is triggered", async () => {
      // Bypass the disabled radio to prove the setTee guard rejects cpu-gpu on its own; children (the real
      // RadioGroupItems) are intentionally not rendered since they require the real RadioGroup context. Cast
      // is needed because the real RadioGroup is a forwardRef component, structurally incompatible with a
      // plain function component.
      const RadioGroup = ((props: { onValueChange: (value: string) => void }) => (
        <button type="button" onClick={() => props.onValueChange("cpu-gpu")}>
          force-cpu-gpu
        </button>
      )) as unknown as typeof DEPENDENCIES.RadioGroup;
      const { getValues } = setup({ tee: "cpu", isGpuBlocked: true, dependencies: { RadioGroup } });

      await userEvent.click(screen.getByRole("button", { name: "force-cpu-gpu" }));

      expect(getValues().services[0].params?.tee).toBe("cpu");
    });
  });

  it("does not show the free-trial warning when GPU is not blocked", () => {
    setup({ tee: "cpu" });

    expect(screen.queryByText(/high-end GPUs aren't available on a free trial/i)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).not.toBeDisabled();
  });

  function setup(input: {
    tee?: "cpu" | "cpu-gpu";
    params?: ServiceType["params"];
    profile?: Partial<ServiceType["profile"]>;
    locked?: boolean;
    isGpuBlocked?: boolean;
    onUnlock?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const params = input.params ?? (input.tee ? { tee: input.tee } : undefined);
    const base = defaultServiceWithPlacement({ params });
    const values: SdlBuilderFormValuesType = {
      ...base,
      services: [{ ...base.services[0], profile: { ...base.services[0].profile, ...input.profile } }]
    };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <TooltipProvider>
          <ConfidentialComputeCard
            serviceIndex={0}
            locked={input.locked}
            isGpuBlocked={input.isGpuBlocked}
            onUnlock={input.onUnlock}
            dependencies={{ ...DEPENDENCIES, ...input.dependencies }}
          />
        </TooltipProvider>
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
