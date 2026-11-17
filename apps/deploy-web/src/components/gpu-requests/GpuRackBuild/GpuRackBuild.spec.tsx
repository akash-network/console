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

    expect(screen.getAllByRole("button", { name: /^Change [A-Z]/ }).map(button => button.getAttribute("aria-label"))).toEqual([
      "Change Network: InfiniBand",
      "Change Storage: 4 TB/node",
      "Change GPUs: 16× B300",
      "Change Term: M2M · ASAP",
      "Change Uptime: No SLA",
      "Change Region: Anywhere"
    ]);
    expect(screen.getByRole("button", { name: "Change Uptime: No SLA" })).toHaveAttribute("title", "Change the uptime");
    expect(onChangeStep.mock.calls).toEqual([["sla"], ["start"]]);
  });

  it("lets the keyboard reach each built part once and go back to its question", async () => {
    const { onChangeStep } = setup({ startingPoint: STARTER_PACKAGES[1], reached: ["start"], current: "review", draft: { sla: "99.9" } });

    expect(screen.getAllByRole("button", { name: /^Change the / }).map(part => part.getAttribute("aria-label"))).toEqual([
      "Change the region",
      "Change the term",
      "Change the setup",
      "Change the GPUs",
      "Change the storage",
      "Change the network",
      "Change the uptime"
    ]);
    expect(screen.getAllByRole("button", { name: /^Change the / }).every(part => part.getAttribute("tabindex") === "0")).toBe(true);
    expect(screen.getByRole("button", { name: "Change the GPUs" }).querySelector("title")).toHaveTextContent("Change the GPUs");

    screen.getByRole("button", { name: "Change the network" }).focus();
    await userEvent.keyboard("{Enter}");
    screen.getByRole("button", { name: "Change the uptime" }).focus();
    await userEvent.keyboard(" ");
    await userEvent.keyboard("a");

    expect(onChangeStep.mock.calls).toEqual([["start"], ["sla"]]);
  });

  it("keeps a part's second piece out of the tab order", () => {
    const { container } = setup({ startingPoint: STARTER_PACKAGES[1], reached: ["start"], current: "review", draft: { sla: "99.9" } });

    expect(
      [...container.querySelectorAll('[data-part][tabindex="-1"]')].map(part => [part.getAttribute("data-part"), part.getAttribute("aria-hidden")])
    ).toEqual([
      ["rack", "true"],
      ["network", "true"],
      ["power", "true"]
    ]);
  });

  it("lights a callout while its part has keyboard focus", () => {
    setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region"], current: "region" });
    const callout = screen.getByRole("button", { name: "Change Storage: 4 TB/node" });

    fireEvent.focus(screen.getByRole("button", { name: "Change the storage" }));
    expect(callout).toHaveAttribute("data-hot");

    fireEvent.blur(screen.getByRole("button", { name: "Change the storage" }));
    expect(callout).not.toHaveAttribute("data-hot");
  });

  it("keeps a focused part lit while the pointer passes over it and other parts", () => {
    const { container } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region"], current: "region" });
    const storagePart = screen.getByRole("button", { name: "Change the storage" });
    const storageCallout = screen.getByRole("button", { name: "Change Storage: 4 TB/node" });
    const networkCallout = screen.getByRole("button", { name: "Change Network: InfiniBand" });

    fireEvent.focus(storagePart);
    fireEvent.mouseEnter(storagePart);
    fireEvent.mouseLeave(storagePart);
    fireEvent.mouseEnter(container.querySelector('[data-part="network"]')!);

    expect(storageCallout).toHaveAttribute("data-hot");
    expect(storagePart.querySelector(`[data-tone="lit"]`)).toBeInTheDocument();
    expect(networkCallout).toHaveAttribute("data-hot");

    fireEvent.blur(storagePart);

    expect(storageCallout).not.toHaveAttribute("data-hot");
    expect(storagePart.querySelector(`[data-tone="lit"]`)).not.toBeInTheDocument();
    expect(networkCallout).toHaveAttribute("data-hot");
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
    [
      "8U servers caged on the raised floor",
      { startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla", "timing"], current: "timing", draft: { sla: "99.5" } }
    ],
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
