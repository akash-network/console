import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, GpuCard } from "./GpuCard";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const GPU_VENDORS: GpuVendor[] = [
  {
    name: "nvidia",
    models: [
      { name: "h100", memory: ["80Gi"], interface: ["sxm"] },
      { name: "t4", memory: ["16Gi"], interface: ["pcie"] }
    ]
  }
];

/**
 * The trial-gate cases live in their own spec so they run in a fresh jsdom — see the note in
 * GpuCard.spec: the sibling file's many Radix Select interactions leak under jsdom and make every
 * later render progressively slower. Isolating these keeps them fast and deterministic.
 */
describe("GpuCard trial gate", () => {
  it("locks a blocked model option while keeping allowed ones selectable", async () => {
    const user = setup({ isBlockedModel: (_vendor, model) => model === "h100" });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));

    expect(await screen.findByRole("option", { name: /h100/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /t4/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("calls onUnlock from the unlock CTA when the vendor has a blocked model", () => {
    const onUnlock = vi.fn();
    setup({ isBlockedModel: (_vendor, model) => model === "h100", onUnlock });

    fireEvent.click(screen.getByRole("button", { name: /unlock high-end gpus/i }));

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("shows no unlock CTA when no model is blocked", () => {
    setup({});

    expect(screen.queryByRole("button", { name: /unlock/i })).not.toBeInTheDocument();
  });

  it("locks the 'Any model' option when the empty model is blocked for the trial", async () => {
    const user = setup({ isBlockedModel: (_vendor, model) => model === "" || model === "h100" });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));

    expect(await screen.findByRole("option", { name: /any model/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the 'Any model' option selectable when nothing is blocked", async () => {
    const user = setup({});

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));

    expect(await screen.findByRole("option", { name: /any model/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  function setup(input: { isBlockedModel?: (vendor?: string | null, model?: string | null) => boolean; onUnlock?: () => void }) {
    const values = defaultServiceWithPlacement({
      profile: {
        cpu: 0.5,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
        hasGpu: true,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false, type: "beta2" }]
      }
    });

    const useGpuModels: typeof DEPENDENCIES.useGpuModels = () => {
      const result = mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>({ isLoading: false, isError: false } as Partial<
        ReturnType<typeof DEPENDENCIES.useGpuModels>
      >);
      result.data = GPU_VENDORS;
      return result;
    };
    const useFieldError: typeof DEPENDENCIES.useFieldError = () => ({ error: undefined });

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <GpuCard
          serviceIndex={0}
          isBlockedModel={input.isBlockedModel}
          onUnlock={input.onUnlock}
          dependencies={{ ...DEPENDENCIES, useGpuModels, useFieldError }}
        />
      </Wrapper>
    );

    return userEvent.setup();
  }
});
