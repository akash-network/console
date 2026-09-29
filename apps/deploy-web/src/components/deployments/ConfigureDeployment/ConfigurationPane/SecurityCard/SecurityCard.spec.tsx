import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, SecurityCard } from "./SecurityCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SecurityCard.name, () => {
  it("offers confidential compute behind a header switch that starts off", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Expand Confidential compute" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).not.toBeChecked();
    expect(screen.queryByRole("group", { name: "Attestation" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Locked")).not.toBeInTheDocument();
  });

  it("turns cpu confidential compute on and opens its settings from the header switch", async () => {
    const { getValues } = setup({});

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[0].params?.tee).toBe("cpu");
    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "CPU" })).toBeChecked();
  });

  it("turns confidential compute off and hides its settings from the header switch", async () => {
    const { getValues } = setup({ tee: "cpu-gpu" });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[0].params?.tee).toBeUndefined();
    expect(screen.queryByRole("group", { name: "Attestation" })).not.toBeInTheDocument();
  });

  it("switches its own service", async () => {
    const { getValues } = setup({ serviceIndex: 1 });

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));

    expect(getValues().services[1].params?.tee).toBe("cpu");
    expect(getValues().services[0].params?.tee).toBeUndefined();
  });

  it("passes the service, lock and trial state through to the confidential compute fields", () => {
    const ConfidentialComputeFields = vi.fn<typeof DEPENDENCIES.ConfidentialComputeFields>(() => null);
    const onUnlock = vi.fn();

    setup({ serviceIndex: 1, tee: "cpu", locked: true, isGpuBlocked: true, onUnlock, dependencies: { ConfidentialComputeFields } });

    expect(ConfidentialComputeFields).toHaveBeenCalledWith({ serviceIndex: 1, locked: true, isGpuBlocked: true, onUnlock }, expect.anything());
  });

  it("marks the card locked and disables its switch while the pane is locked", () => {
    setup({ tee: "cpu", locked: true });

    expect(screen.getByLabelText("Locked")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).toBeDisabled();
  });

  it("says confidential compute is off when opened while off and locked", async () => {
    const { getValues } = setup({ locked: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand Confidential compute" }));

    expect(screen.getByText("Confidential compute is off.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Attestation" })).not.toBeInTheDocument();
    expect(getValues().services[0].params?.tee).toBeUndefined();
  });

  function setup(input: {
    tee?: "cpu" | "cpu-gpu";
    serviceIndex?: number;
    locked?: boolean;
    isGpuBlocked?: boolean;
    onUnlock?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const serviceIndex = input.serviceIndex ?? 0;
    const base = defaultServiceWithPlacement();
    const params = input.tee ? { tee: input.tee } : undefined;
    const services = Array.from({ length: serviceIndex + 1 }, (_, index) =>
      defaultService(base.placements[0].id, { title: `service-${index + 1}`, params: index === serviceIndex ? params : undefined })
    );
    const values: SdlBuilderFormValuesType = { ...base, services };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <TooltipProvider>
          <SecurityCard
            serviceIndex={serviceIndex}
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
