import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { forwardRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ConfidentialComputeFields, DEPENDENCIES } from "./ConfidentialComputeFields";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ConfidentialComputeFields.name, () => {
  it("explains confidential compute and asks for the attestation", () => {
    setup({ tee: "cpu" });

    expect(screen.getByText(/Runs this service inside a Trusted Execution Environment \(TEE\)/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Attestation" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "CPU" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).not.toBeChecked();
  });

  it("switches the TEE to cpu-gpu when that attestation is chosen", async () => {
    const { getValues } = setup({ tee: "cpu" });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    expect(getValues().services[0].params?.tee).toBe("cpu-gpu");
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeChecked();
  });

  it("reflects an initial cpu-gpu value", () => {
    setup({ tee: "cpu-gpu" });

    expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeChecked();
  });

  it("keeps the attestation when the chosen one is clicked again", async () => {
    const { getValues } = setup({ tee: "cpu" });

    await userEvent.click(screen.getByRole("radio", { name: "CPU" }));

    expect(getValues().services[0].params?.tee).toBe("cpu");
    expect(screen.getByRole("radio", { name: "CPU" })).toBeChecked();
  });

  it("describes the chosen attestation", async () => {
    setup({ tee: "cpu" });

    expect(screen.getByText("Run inside a CPU-only Trusted Execution Environment.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    expect(screen.getByText("Attest the GPU as well. This adds a GPU to this service.")).toBeInTheDocument();
    expect(screen.queryByText("Run inside a CPU-only Trusted Execution Environment.")).not.toBeInTheDocument();
  });

  it("describes no attestation before one is chosen", () => {
    setup({});

    expect(screen.queryByText("Run inside a CPU-only Trusted Execution Environment.")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "CPU" })).not.toBeChecked();
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

  it("leaves GPU untouched when cpu is chosen", async () => {
    const { getValues } = setup({ tee: "cpu-gpu", profile: { hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia" }] } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU" }));

    expect(getValues().services[0].profile.hasGpu).toBe(true);
    expect(getValues().services[0].profile.gpu).toBe(2);
  });

  it("preserves other params when the attestation changes", async () => {
    const { getValues } = setup({ params: { permissions: { read: ["logs"] }, tee: "cpu" } });

    await userEvent.click(screen.getByRole("radio", { name: "CPU-GPU" }));

    expect(getValues().services[0].params).toMatchObject({ permissions: { read: ["logs"] }, tee: "cpu-gpu" });
  });

  it("disables the attestations while the pane is locked", () => {
    setup({ tee: "cpu", locked: true });

    expect(screen.getByRole("radio", { name: "CPU" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "CPU-GPU" })).toBeDisabled();
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

  it("hides the resource carve-out while no attestation is chosen", () => {
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
      expect(within(screen.getByRole("radio", { name: "CPU-GPU" })).getByLabelText("Requires credits")).toBeInTheDocument();
      expect(within(screen.getByRole("radio", { name: "CPU" })).queryByLabelText("Requires credits")).not.toBeInTheDocument();
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

    it("ignores a cpu-gpu selection even if the disabled attestation is triggered", async () => {
      const ToggleGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DEPENDENCIES.ToggleGroup>>((props, _ref) => (
        <button type="button" onClick={() => (props.onValueChange as (value: string) => void)("cpu-gpu")}>
          force-cpu-gpu
        </button>
      ));
      const { getValues } = setup({ tee: "cpu", isGpuBlocked: true, dependencies: { ToggleGroup } });

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
