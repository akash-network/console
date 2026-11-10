import { describe, expect, it, vi } from "vitest";

import type { GpuQuoteDraft, QuoteStepId, StartingPoint } from "../gpuQuoteDraft/gpuQuoteDraft";
import { applyStartingPoint, createBlankDraft, CUSTOM_STARTING_POINT, listSteps, STARTER_PACKAGES } from "../gpuQuoteDraft/gpuQuoteDraft";
import { GpuRackBuild } from "./GpuRackBuild";
import { describeRackBuild } from "./rackBuild";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(GpuRackBuild.name, () => {
  it("names the setup and what has been built in its corners", () => {
    setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start"], current: "start" });

    expect(screen.getByText("Inference fleet")).toBeInTheDocument();
    expect(screen.getByText("Click to change")).toBeInTheDocument();
    expect(screen.getByText("16 GPUs")).toBeInTheDocument();
  });

  it("offers a callout per built part that goes back to its question", async () => {
    const { onChangeStep } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start"], current: "review" });

    await userEvent.click(screen.getByRole("button", { name: "Change Uptime: No SLA" }));
    await userEvent.click(screen.getByRole("button", { name: "Change GPUs: 16× B300" }));

    expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual([
      "Change Network: InfiniBand",
      "Change Storage: 4 TB/node",
      "Change GPUs: 16× B300",
      "Change Term: M2M · ASAP",
      "Change Uptime: No SLA",
      "Change Region: Anywhere"
    ]);
    expect(onChangeStep.mock.calls).toEqual([["sla"], ["start"]]);
  });

  it("marks the callout of the question being asked", () => {
    setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla"], current: "sla" });

    expect(screen.getByRole("button", { name: "Change Uptime: No SLA" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Change Region: Anywhere" })).not.toHaveAttribute("aria-current");
  });

  it("goes back to a question from its part of the drawing", () => {
    const { container, onChangeStep } = setup({ draft: { gpuModel: "h100" }, reached: ["start"], current: "review" });

    for (const part of ["rack", "servers", "network", "storage", "floor", "power", "cage"]) {
      fireEvent.click(container.querySelector(`[data-part="${part}"]`)!);
    }

    expect(onChangeStep.mock.calls.flat()).toEqual(["start", "gpu", "interconnect", "storage", "region", "sla", "timing"]);
  });

  it("lights a callout while its part is hovered or the callout is focused", () => {
    const { container } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region"], current: "region" });
    const network = screen.getByRole("button", { name: "Change Network: InfiniBand" });

    fireEvent.mouseEnter(container.querySelector('[data-part="network"]')!);
    expect(network).toHaveAttribute("data-hot");

    fireEvent.mouseLeave(container.querySelector('[data-part="network"]')!);
    expect(network).not.toHaveAttribute("data-hot");

    fireEvent.focus(network);
    expect(network).toHaveAttribute("data-hot");

    fireEvent.mouseLeave(screen.getByRole("button", { name: "Change Region: Anywhere" }));
    expect(network).toHaveAttribute("data-hot");

    fireEvent.blur(network);
    expect(network).not.toHaveAttribute("data-hot");
  });

  it.each([
    ["8U servers caged on the raised floor", { startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla", "timing"], current: "timing", draft: { sla: "99.5" } }],
    ["an NVL72 rack backed by a UPS", { startingPoint: STARTER_PACKAGES[1], reached: ["start", "region", "sla"], current: "sla", draft: { sla: "99.9" } }]
  ] as [string, SetupInput][])("draws %s", (_, input) => {
    const { container } = setup(input);

    expect(describeDrawing(container.querySelector("svg")!)).toMatchSnapshot();
  });

  type SetupInput = { startingPoint?: StartingPoint; draft?: Partial<GpuQuoteDraft>; reached: QuoteStepId[]; current: QuoteStepId };

  function setup(input: SetupInput) {
    const onChangeStep = vi.fn();
    const startingPoint = input.startingPoint ?? CUSTOM_STARTING_POINT;
    const draft = { ...applyStartingPoint(createBlankDraft("me@example.com"), startingPoint), ...input.draft };
    const build = describeRackBuild({
      steps: listSteps(startingPoint.answers),
      draft,
      setupName: input.startingPoint?.name,
      reachedSteps: new Set(input.reached),
      currentStep: input.current
    });
    const { container } = render(<GpuRackBuild build={build} onChangeStep={onChangeStep} />);

    return { container, onChangeStep };
  }

  function describeDrawing(element: Element, depth = 0): string {
    const attributes = [...element.attributes].map(attribute => `${attribute.name}="${attribute.value}"`).join(" ");
    const line = `${"  ".repeat(depth)}<${element.tagName} ${attributes}>`;
    return [line, ...[...element.children].map(child => describeDrawing(child, depth + 1))].join("\n");
  }
});
