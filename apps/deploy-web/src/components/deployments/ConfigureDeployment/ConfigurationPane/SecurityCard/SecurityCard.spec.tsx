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
  it("renders the confidential compute opt-in inside an expanded, unlocked Security card", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Collapse Security" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable confidential compute" })).toBeEnabled();
    expect(screen.queryByLabelText("Locked")).not.toBeInTheDocument();
  });

  it.each([
    { case: "no TEE is set", tee: undefined, summary: "Off" },
    { case: "the TEE is cpu", tee: "cpu", summary: "Confidential compute (CPU)" },
    { case: "the TEE is cpu-gpu", tee: "cpu-gpu", summary: "Confidential compute (CPU + GPU)" }
  ] as const)("reads $summary once collapsed when $case", async ({ tee, summary }) => {
    setup({ tee });

    await userEvent.click(screen.getByRole("button", { name: "Collapse Security" }));

    expect(screen.getByText(summary)).toBeInTheDocument();
  });

  it("keeps the summary out of the header while expanded", () => {
    setup({ tee: "cpu" });

    expect(screen.queryByText("Confidential compute (CPU)")).not.toBeInTheDocument();
  });

  it("summarizes confidential compute turned on in the card", async () => {
    setup({});

    await userEvent.click(screen.getByRole("switch", { name: "Enable confidential compute" }));
    await userEvent.click(screen.getByRole("button", { name: "Collapse Security" }));

    expect(screen.getByText("Confidential compute (CPU)")).toBeInTheDocument();
  });

  it("summarizes the TEE of its own service", async () => {
    setup({ serviceIndex: 1, tee: "cpu-gpu" });

    await userEvent.click(screen.getByRole("button", { name: "Collapse Security" }));

    expect(screen.getByText("Confidential compute (CPU + GPU)")).toBeInTheDocument();
  });

  it("passes the service, lock and trial state through to the confidential compute fields", () => {
    const ConfidentialComputeFields = vi.fn<typeof DEPENDENCIES.ConfidentialComputeFields>(() => null);
    const onUnlock = vi.fn();

    setup({ serviceIndex: 1, locked: true, isGpuBlocked: true, onUnlock, dependencies: { ConfidentialComputeFields } });

    expect(ConfidentialComputeFields).toHaveBeenCalledWith({ serviceIndex: 1, locked: true, isGpuBlocked: true, onUnlock }, expect.anything());
  });

  it("marks the card locked while the pane is locked", () => {
    setup({ locked: true });

    expect(screen.getByLabelText("Locked")).toBeInTheDocument();
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

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
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
  }
});
