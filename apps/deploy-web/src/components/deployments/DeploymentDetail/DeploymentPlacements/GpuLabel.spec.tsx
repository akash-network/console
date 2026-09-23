import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, GpuLabel } from "./GpuLabel";
import type { DetectedGpuSummary } from "./placementModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(GpuLabel.name, () => {
  it("shows each count beside the model it counts", () => {
    const { container } = setup({
      gpuAmount: 3,
      models: ["*"],
      detected: [
        { displayName: "H100", count: 2 },
        { displayName: "L40S", count: 1 }
      ]
    });

    expect(container).toHaveTextContent("2× H100, 1× L40S");
    expect(screen.getByText("H100")).toBeInTheDocument();
    expect(screen.getByText("L40S")).toBeInTheDocument();
  });

  it("offers the whole label on hover, since a long one is cut short", () => {
    const { CustomTooltip } = setup({ gpuAmount: 2, models: ["h100", "a100"] });

    expect(CustomTooltip).toHaveBeenCalledWith(expect.objectContaining({ title: "2× H100 / A100" }), {});
  });

  it("lets a keyboard reach the whole label", async () => {
    setup({ gpuAmount: 2, models: ["h100", "a100"], dependencies: DEPENDENCIES });

    await userEvent.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("2× H100 / A100");
  });

  it("shows the count alone when no model is declared", () => {
    const { container } = setup({ gpuAmount: 1, models: ["*"] });

    expect(container).toHaveTextContent(/^1$/);
  });

  it("holds the model's place with a skeleton while the reading loads", () => {
    const { container } = setup({ gpuAmount: 1, models: ["h100"], isLoading: true });

    expect(screen.getByTestId("gpu-model-skeleton")).toBeInTheDocument();
    expect(container).toHaveTextContent(/^1×$/);
  });

  it("shows an em dash for a deployment with no gpu", () => {
    const { container } = setup({ gpuAmount: 0, models: [], isLoading: true });

    expect(container).toHaveTextContent(/^—$/);
  });

  function setup(input: { gpuAmount: number; models: string[]; detected?: DetectedGpuSummary[]; isLoading?: boolean; dependencies?: typeof DEPENDENCIES }) {
    const CustomTooltip = vi.fn<typeof DEPENDENCIES.CustomTooltip>(({ children }) => <>{children}</>);
    const { container } = render(
      <TooltipProvider>
        <GpuLabel {...input} dependencies={input.dependencies ?? { CustomTooltip }} />
      </TooltipProvider>
    );

    return { container, CustomTooltip };
  }
});
