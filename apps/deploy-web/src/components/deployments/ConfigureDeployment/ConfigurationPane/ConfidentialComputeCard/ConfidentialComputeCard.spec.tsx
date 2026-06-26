import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

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

  function setup(input: { tee?: "cpu" | "cpu-gpu"; params?: ServiceType["params"]; profile?: Partial<ServiceType["profile"]>; locked?: boolean }) {
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
        <ConfidentialComputeCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES }} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
