import type { PropsWithChildren } from "react";
import { FormProvider, useForm, type UseFormSetValue } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { HardwarePreset } from "./hardwarePresets";
import { DEPENDENCIES, PresetsCard } from "./PresetsCard";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const PRESETS: HardwarePreset[] = [
  { id: "small", label: "Small preset", group: "compute", cpu: 2, ram: 4, ramUnit: "Gi", storage: 20, storageUnit: "Gi" },
  {
    id: "gpu",
    label: "GPU preset",
    group: "gpu",
    cpu: 4,
    ram: 16,
    ramUnit: "Gi",
    storage: 100,
    storageUnit: "Gi",
    gpu: 2,
    gpuVendor: "nvidia",
    gpuModel: "t4"
  },
  {
    id: "gpu-h100",
    label: "H100 preset",
    group: "gpu",
    cpu: 8,
    ram: 32,
    ramUnit: "Gi",
    storage: 100,
    storageUnit: "Gi",
    gpu: 1,
    gpuVendor: "nvidia",
    gpuModel: "h100"
  }
];

describe(PresetsCard.name, () => {
  it("applies CPU, memory, and storage from the picked preset", async () => {
    const { getValues } = setup({});

    await pickPreset("Small preset");

    const profile = getValues().services[0].profile;
    expect(profile.cpu).toBe(2);
    expect(profile.ram).toBe(4);
    expect(profile.ramUnit).toBe("Gi");
    expect(profile.storage[0]).toMatchObject({ size: 20, unit: "Gi" });
  });

  it("enables GPU when the preset includes one", async () => {
    const { getValues } = setup({});

    await pickPreset("GPU preset");

    const profile = getValues().services[0].profile;
    expect(profile.gpu).toBe(2);
    expect(profile.hasGpu).toBe(true);
    expect(profile.gpuModels).toEqual([{ vendor: "nvidia", name: "t4" }]);
  });

  it("leaves GPU disabled for a non-GPU preset", async () => {
    const { getValues } = setup({});

    await pickPreset("Small preset");

    expect(getValues().services[0].profile.hasGpu).toBe(false);
    expect(getValues().services[0].profile.gpu).toBe(0);
  });

  it("clears stale GPU models when switching to a non-GPU preset", async () => {
    const { getValues } = setup({});

    await pickPreset("GPU preset");
    await pickPreset("Small preset");

    expect(getValues().services[0].profile.gpuModels).toEqual([]);
  });

  it("re-applies the same preset after manual edits", async () => {
    const { getValues, setValue } = setup({});

    await pickPreset("Small preset");
    act(() => setValue(`services.${0}.profile.cpu`, 9));
    await pickPreset("Small preset");

    expect(getValues().services[0].profile.cpu).toBe(2);
  });

  it("does not modify persistent storage entries", async () => {
    const persistentStorage = { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data", isReadOnly: false };
    const { getValues } = setup({
      storage: [{ size: 1, unit: "Gi", isPersistent: false, type: "beta2" }, persistentStorage]
    });

    await pickPreset("Small preset");

    expect(getValues().services[0].profile.storage[1]).toEqual(persistentStorage);
  });

  it("reflects the picked preset in the select trigger", async () => {
    setup({});

    await pickPreset("Small preset");

    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent("Small preset");
  });

  it("falls back to the placeholder once the resources no longer match a preset", async () => {
    const { setValue } = setup({});

    await pickPreset("Small preset");
    act(() => setValue(`services.${0}.profile.cpu`, 9));

    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent("Choose a starting point");
  });

  it("disables the preset select while locked", () => {
    setup({ locked: true });

    expect(screen.getByRole("combobox", { name: "Preset" })).toBeDisabled();
  });

  it("locks a blocked GPU preset while keeping allowed presets selectable", async () => {
    setup({ isBlockedModel: (_vendor, model) => model === "h100" });

    await userEvent.click(screen.getByRole("combobox", { name: "Preset" }));

    expect(await screen.findByRole("option", { name: /H100 preset/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /GPU preset/ })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /Small preset/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("still applies an allowed preset while some GPUs are blocked", async () => {
    const { getValues } = setup({ isBlockedModel: (_vendor, model) => model === "h100" });

    await pickPreset("Small preset");

    expect(getValues().services[0].profile.cpu).toBe(2);
  });

  it("calls onUnlock from the unlock CTA when a GPU preset is blocked", async () => {
    const onUnlock = vi.fn();
    setup({ isBlockedModel: (_vendor, model) => model === "h100", onUnlock });

    await userEvent.click(screen.getByRole("button", { name: /unlock high-end gpus/i }));

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("shows no unlock CTA when nothing is blocked", () => {
    setup({});

    expect(screen.queryByRole("button", { name: /unlock/i })).not.toBeInTheDocument();
  });

  it("tracks the selected preset", async () => {
    const { analyticsService } = setup({});

    await pickPreset("Small preset");

    expect(analyticsService.track).toHaveBeenCalledWith("configure_preset_selected", { category: "deployments", preset: "small" });
  });

  async function pickPreset(name: string) {
    await userEvent.click(screen.getByRole("combobox", { name: "Preset" }));
    await userEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
  }

  function setup(input: {
    storage?: SdlBuilderFormValuesType["services"][number]["profile"]["storage"];
    locked?: boolean;
    isBlockedModel?: (vendor?: string | null, model?: string | null) => boolean;
    onUnlock?: () => void;
  }) {
    const values = defaultServiceWithPlacement();
    if (input.storage) {
      values.services[0].profile.storage = input.storage;
    }

    let getValues: () => SdlBuilderFormValuesType = () => values;
    let setValue!: UseFormSetValue<SdlBuilderFormValuesType>;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      setValue = form.setValue;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    const analyticsService = mock<AnalyticsService>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });

    render(
      <Wrapper>
        <PresetsCard
          serviceIndex={0}
          locked={input.locked}
          isBlockedModel={input.isBlockedModel}
          onUnlock={input.onUnlock}
          dependencies={{ ...DEPENDENCIES, hardwarePresets: PRESETS, useServices }}
        />
      </Wrapper>
    );

    return { getValues: () => getValues(), setValue, analyticsService };
  }
});
