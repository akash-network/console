import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { TrialResourceLimit } from "../HardwareSection/trialResourceLimit/trialResourceLimit";
import { DEPENDENCIES, TrialResourceLimitHint } from "./TrialResourceLimitHint";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(TrialResourceLimitHint.name, () => {
  it("states the trial's caps while the deployment fits within them", () => {
    setup({ limit: { maxCpu: 4, maxMemoryGi: 16 }, cpu: 4, ram: 16 });

    expect(screen.getByText("Free trial deployments are limited to 4 vCPU and 16 GiB of memory.")).toBeInTheDocument();
    expect(screen.queryByText(/This deployment requests/)).not.toBeInTheDocument();
  });

  it("warns with the requested size and offers to add credits once the deployment is over a cap", () => {
    const onUnlock = vi.fn();
    const { UnlockGpusButton } = setup({ limit: { maxCpu: 4, maxMemoryGi: 16 }, cpu: 16, ram: 64, count: 2, onUnlock });

    expect(
      screen.getByText("This deployment requests 32 vCPU and 128 GiB of memory. Free trial deployments are limited to 4 vCPU and 16 GiB of memory.")
    ).toBeInTheDocument();
    expect(UnlockGpusButton).toHaveBeenCalledWith(
      expect.objectContaining({
        onUnlock,
        prominent: true,
        label: "Unlock larger deployments",
        explanation: "Larger deployments aren't included in your free trial. Add credits to unlock them, along with longer runtimes and the full Console."
      }),
      expect.anything()
    );
  });

  it("renders nothing when no trial cap applies", () => {
    const { container, UnlockGpusButton } = setup({ limit: undefined, cpu: 16, ram: 64 });

    expect(container).toBeEmptyDOMElement();
    expect(UnlockGpusButton).not.toHaveBeenCalled();
  });

  function setup(input: { limit: TrialResourceLimit | undefined; cpu: number; ram: number; count?: number; onUnlock?: () => void }) {
    const base = defaultServiceWithPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: base.placements,
      services: [{ ...base.services[0], count: input.count ?? 1, profile: { ...base.services[0].profile, cpu: input.cpu, ram: input.ram, ramUnit: "Gi" } }],
      endpoints: []
    };
    const UnlockGpusButton = vi.fn(() => null);
    const dependencies = MockComponents(DEPENDENCIES, { UnlockGpusButton, useTrialResourceLimit: () => input.limit });
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const { container } = render(<TrialResourceLimitHint onUnlock={input.onUnlock} dependencies={dependencies} />, { wrapper: Wrapper });

    return { container, UnlockGpusButton };
  }
});
