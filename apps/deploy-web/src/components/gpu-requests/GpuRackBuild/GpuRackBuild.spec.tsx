import { describe, expect, it, vi } from "vitest";

import type { GpuQuoteDraft, QuoteStepId, StartingPoint } from "../gpuQuoteDraft/gpuQuoteDraft";
import { applyStartingPoint, createBlankDraft, CUSTOM_STARTING_POINT, listSteps, STARTER_PACKAGES } from "../gpuQuoteDraft/gpuQuoteDraft";
import { GpuRackBuild } from "./GpuRackBuild";
import type { RackPart } from "./rackBuild";
import { describeRackBuild } from "./rackBuild";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(GpuRackBuild.name, () => {
  it("offers a callout per built part that goes back to its question", async () => {
    const { onChangeStep } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start"], current: "review" });

    await userEvent.click(screen.getByRole("button", { name: "Change Uptime: No SLA" }));
    await userEvent.click(screen.getByRole("button", { name: "Change GPUs: 16× B300" }));

    expect(calloutLabels()).toEqual([
      "Change GPUs: 16× B300",
      "Change Network: InfiniBand",
      "Change Region: Anywhere",
      "Change Storage: 4 TB/node",
      "Change Uptime: No SLA",
      "Change Term: M2M · ASAP"
    ]);
    expect(screen.getByRole("button", { name: "Change Uptime: No SLA" })).toHaveAttribute("title", "Change the uptime");
    expect(onChangeStep.mock.calls).toEqual([["sla"], ["start"]]);
  });

  it("stacks callouts in the order their answers arrive and never moves one that is already placed", () => {
    const { show } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start"], current: "start" });
    expect(calloutLabels()).toEqual(["Change GPUs: 16× B300", "Change Network: InfiniBand", "Change Storage: 4 TB/node"]);

    show({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla"], current: "sla", draft: { sla: "99.5" } });
    expect(calloutLabels()).toEqual([
      "Change GPUs: 16× B300",
      "Change Network: InfiniBand",
      "Change Storage: 4 TB/node",
      "Change Region: Anywhere",
      "Change Uptime: 99.5%"
    ]);

    show({ reached: ["start", "region", "sla"], current: "start" });
    expect(calloutLabels()).toEqual(["Change Region: Anywhere", "Change Uptime: No SLA"]);

    show({ reached: ["start", "region", "sla", "gpu", "interconnect"], current: "interconnect", draft: { gpuModel: "h100" } });
    expect(calloutLabels()).toEqual(["Change GPUs: 8× H100", "Change Network: InfiniBand", "Change Region: Anywhere", "Change Uptime: No SLA"]);
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
    expect(storagePart.querySelector('[data-tone="lit"]')).toBeInTheDocument();
    expect(networkCallout).toHaveAttribute("data-hot");

    fireEvent.blur(storagePart);

    expect(storageCallout).not.toHaveAttribute("data-hot");
    expect(storagePart.querySelector('[data-tone="lit"]')).not.toBeInTheDocument();
    expect(networkCallout).toHaveAttribute("data-hot");
  });

  it("marks the callout of the question being asked", () => {
    setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla"], current: "sla" });

    expect(screen.getByRole("button", { name: "Change Uptime: No SLA" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Change Region: Anywhere" })).not.toHaveAttribute("aria-current");
  });

  it("goes back to a question from its part of the drawing", () => {
    const { container, onChangeStep } = setup({ draft: { gpuModel: "h100" }, reached: ["start"], current: "review" });

    for (const part of ["rack", "servers", "network", "storage", "floor", "power", "calendar"]) {
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

  it("lights the part of the question being asked, the part under the pointer, and the servers on the review", () => {
    const { container, show } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla"], current: "sla" });
    const litParts = () => PARTS.filter(part => container.querySelector(`[data-part="${part}"] [data-lit]`));

    expect(litParts()).toEqual(["power"]);

    fireEvent.mouseEnter(container.querySelector('[data-part="floor"]')!);
    expect(litParts()).toEqual(["floor", "power"]);

    fireEvent.mouseLeave(container.querySelector('[data-part="floor"]')!);
    show({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla"], current: "review" });
    expect(litParts()).toEqual(["servers"]);
  });

  it("turns the status LEDs on once the rack has power", () => {
    const { container, show } = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region"], current: "region" });
    const ledsOn = () => container.querySelectorAll("circle[data-on]").length;

    expect(ledsOn()).toBe(0);

    show({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "region", "sla"], current: "sla" });
    expect(ledsOn()).toBe(6);
  });

  it("heads the wall calendar with the term", () => {
    setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", "timing"], current: "timing", draft: { term: "12_months" } });

    expect(screen.getByText("12 MONTHS")).toBeInTheDocument();
  });

  it("draws the whole room around 8U servers: floor, wall calendar, power strips, network and drives", () => {
    const { container } = setup({
      startingPoint: STARTER_PACKAGES[0],
      reached: ["start", "region", "sla", "timing"],
      current: "timing",
      draft: { sla: "99.5", term: "12_months", start: "date", startDate: "2026-12-09" }
    });

    expect(describeDrawing(container.querySelector("svg")!)).toMatchSnapshot();
  });

  it.each([
    [
      "an NVL72's trays, drives and shared cables, backed by a UPS",
      { startingPoint: STARTER_PACKAGES[1], reached: ["start", "sla"], current: "sla", draft: { sla: "99.9" } },
      ["servers", "storage", "network", "power"]
    ],
    [
      "4U servers under a single blanking span before the network arrives",
      { reached: ["start", "gpu", "interconnect", "region", "storage"], current: "gpu", draft: { gpuModel: "pro6000", gpuCount: 16, storageTbPerNode: 30 } },
      ["servers", "storage"]
    ],
    [
      "a one-page calendar with no day marked for a flexible monthly term",
      { reached: ["start", "timing"], current: "start", draft: { start: "flexible" } },
      ["calendar"]
    ],
    ["a thinner-paged calendar for a two-year term", { reached: ["start", "timing"], current: "start", draft: { term: "24_months" } }, ["calendar"]]
  ] as [string, SetupInput, RackPart[]][])("draws %s", (_, input, parts) => {
    const { container } = setup(input);
    const selector = parts.map(part => `[data-part="${part}"]`).join(",");

    expect([...container.querySelectorAll(selector)].map(part => describeDrawing(part)).join("\n")).toMatchSnapshot();
  });

  const PARTS: RackPart[] = ["rack", "servers", "network", "storage", "floor", "power", "calendar"];

  type SetupInput = { startingPoint?: StartingPoint; draft?: Partial<GpuQuoteDraft>; reached: QuoteStepId[]; current: QuoteStepId };

  function setup(input: SetupInput) {
    const onChangeStep = vi.fn();
    const { container, rerender } = render(<GpuRackBuild build={buildOf(input)} onChangeStep={onChangeStep} />);
    const show = (nextInput: SetupInput) => rerender(<GpuRackBuild build={buildOf(nextInput)} onChangeStep={onChangeStep} />);

    return { container, onChangeStep, show };
  }

  function buildOf(input: SetupInput) {
    const startingPoint = input.startingPoint ?? CUSTOM_STARTING_POINT;
    const draft = { ...applyStartingPoint(createBlankDraft("me@example.com"), startingPoint), ...input.draft };

    return describeRackBuild({
      steps: listSteps(startingPoint.answers),
      draft,
      reachedSteps: new Set(input.reached),
      currentStep: input.current,
      today: "2026-11-17"
    });
  }

  function calloutLabels() {
    return screen.getAllByRole("button", { name: /^Change [A-Z]/ }).map(button => button.getAttribute("aria-label"));
  }

  function describeDrawing(element: Element, depth = 0): string {
    const attributes = [...element.attributes].map(attribute => `${attribute.name}="${attribute.value}"`).join(" ");
    const line = `${"  ".repeat(depth)}<${element.tagName} ${attributes}>`;
    return [line, ...[...element.children].map(child => describeDrawing(child, depth + 1))].join("\n");
  }
});
