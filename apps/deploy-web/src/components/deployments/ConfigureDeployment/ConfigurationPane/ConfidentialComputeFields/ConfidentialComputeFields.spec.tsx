import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { forwardRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ConfidentialComputeFields, DEPENDENCIES } from "./ConfidentialComputeFields";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ConfidentialComputeFields.name, () => {
  it("shows only the opt-in and leaves the switch off when no TEE is set", () => {
    setup({});

    expect(screen.getByText("Confidential compute")).toBeInTheDocument();
    expect(screen.getByText("Require hardware-backed TEE providers.")).toBeInTheDocument();
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

  it("describes that the cpu-gpu option adds a GPU to the service", () => {
    setup({ tee: "cpu" });

    expect(screen.getByText("Attest the GPU as well. This adds a GPU to this service.")).toBeInTheDocument();
  });

  it("adds one GPU with a default model when cpu-gpu is chosen for a service without GPUs", async () => {
    const { getValues } = setup({ tee: "cpu", profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    expect(getValues().services[0].profile).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });
  });

  it("preserves an already-configured GPU instead of resetting it when cpu-gpu is chosen", async () => {
    const { getValues } = setup({ tee: "cpu", profile: { hasGpu: true, gpu: 4, gpuModels: [{ vendor: "nvidia", name: "h100" }] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    const profile = getValues().services[0].profile;
    expect(profile.gpu).toBe(4);
    expect(profile.gpuModels).toEqual([{ vendor: "nvidia", name: "h100" }]);
  });

  it("leaves a service without GPUs alone when confidential compute is turned on", async () => {
    const { getValues } = setup({ profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[0].profile).toMatchObject({ hasGpu: false, gpu: 0, gpuModels: [] });
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

  it("shows a disabled switch and no options while off and locked", () => {
    setup({ locked: true });

    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).toBeDisabled();
    expect(screen.queryByRole("radiogroup", { name: "Confidential compute type" })).not.toBeInTheDocument();
  });

  it("previews the attestation-sidecar resource carve-out when enabled", () => {
    setup({ tee: "cpu" });

    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("Attestation sidecar")).toBeInTheDocument();
    expect(screen.getByText("Available to your container")).toBeInTheDocument();
  });

  it.each([
    { case: "the GPU is on", profile: { hasGpu: true, gpu: 2 }, gpuUnits: 2 },
    { case: "the GPU is off but still stores a count", profile: { hasGpu: false, gpu: 2 }, gpuUnits: 0 }
  ])("builds the carve-out from the declared resources with $gpuUnits GPUs when $case", ({ profile, gpuUnits }) => {
    const ConfidentialComputeResources = vi.fn<typeof DEPENDENCIES.ConfidentialComputeResources>(() => null);

    setup({ tee: "cpu-gpu", count: 3, profile: { cpu: 1, ram: 1, ramUnit: "Gi", ...profile }, dependencies: { ConfidentialComputeResources } });

    expect(ConfidentialComputeResources).toHaveBeenLastCalledWith(
      { carveouts: [expect.objectContaining({ teeType: "cpu-gpu", count: 3, gpuUnits, requested: { cpu: 1000, memory: 1024 ** 3 } })] },
      expect.anything()
    );
  });

  it("hides the resource carve-out while confidential compute is off", () => {
    setup({});

    expect(screen.queryByText("Attestation sidecar")).not.toBeInTheDocument();
  });

  it.each([
    { case: "the GPU is off", profile: { hasGpu: false, gpu: 0, gpuModels: [] } },
    { case: "the GPU is on with no units", profile: { hasGpu: true, gpu: 0, gpuModels: [{ vendor: "nvidia" }] } },
    { case: "a switched-off GPU still stores a count", profile: { hasGpu: false, gpu: 2, gpuModels: [{ vendor: "nvidia" }] } }
  ])("asks for GPUs when cpu-gpu is selected and $case", ({ profile }) => {
    setup({ tee: "cpu-gpu", profile });

    expect(
      screen.getByText(
        "CPU-GPU confidential compute attests a GPU, so this service needs GPUs. Set GPUs to 1 or more so providers with confidential-compute GPUs can bid."
      )
    ).toBeInTheDocument();
  });

  it("does not ask for GPUs when cpu-gpu is selected and the service has GPUs", () => {
    setup({ tee: "cpu-gpu", profile: { hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia" }] } });

    expect(screen.queryByText(/so this service needs GPUs/i)).not.toBeInTheDocument();
  });

  it("does not ask for GPUs for CPU-only confidential compute", () => {
    setup({ tee: "cpu", profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    expect(screen.queryByText(/so this service needs GPUs/i)).not.toBeInTheDocument();
  });

  it("stops asking for GPUs once choosing cpu-gpu adds one", async () => {
    setup({ tee: "cpu", profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    expect(screen.queryByText(/so this service needs GPUs/i)).not.toBeInTheDocument();
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

    it("hides the free-trial warning while confidential compute is off", () => {
      setup({ isGpuBlocked: true });

      expect(screen.queryByText(/high-end GPUs aren't available on a free trial/i)).not.toBeInTheDocument();
    });

    it("opens the unlock sheet when the unlock CTA is clicked", async () => {
      const onUnlock = vi.fn();
      setup({ tee: "cpu", isGpuBlocked: true, onUnlock });

      await userEvent.click(screen.getByRole("button", { name: "Unlock high-end GPUs" }));

      expect(onUnlock).toHaveBeenCalledTimes(1);
    });

    it("ignores a cpu-gpu selection even if the disabled radio is triggered", async () => {
      const RadioGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DEPENDENCIES.RadioGroup>>(({ onValueChange }, _ref) => (
        <button type="button" onClick={() => onValueChange?.("cpu-gpu")}>
          force-cpu-gpu
        </button>
      ));
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
    count?: number;
    locked?: boolean;
    isGpuBlocked?: boolean;
    onUnlock?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const params = input.params ?? (input.tee ? { tee: input.tee } : undefined);
    const base = defaultServiceWithPlacement({ params });
    const values: SdlBuilderFormValuesType = {
      ...base,
      services: [{ ...base.services[0], count: input.count ?? base.services[0].count, profile: { ...base.services[0].profile, ...input.profile } }]
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
          <ConfidentialComputeFields
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
