import { describe, expect, it } from "vitest";

import type { CUSTOM_STARTING_POINT, GpuQuoteDraft, QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import { applyStartingPoint, createBlankDraft, listSteps, STARTER_PACKAGES } from "../gpuQuoteDraft/gpuQuoteDraft";
import { describeRackBuild } from "./rackBuild";

describe(describeRackBuild.name, () => {
  it("starts as an empty rack lit for the first question", () => {
    const build = setup({ reached: ["start"], current: "start" });

    expect(build).toMatchObject({
      slots: [],
      blankSpans: [],
      isPowered: false,
      isReview: false,
      currentPart: "rack",
      callouts: [],
      isBuilt: { rack: true, servers: false, network: false, storage: false, floor: false, power: false, calendar: false }
    });
  });

  it("brings in the hardware a package answers with the package and sends its parts back to the package", () => {
    const build = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start"], current: "start" });

    expect(build).toMatchObject({
      kind: "8u",
      slots: [
        { type: "server", bottomUnit: 0, units: 8 },
        { type: "server", bottomUnit: 8, units: 8 }
      ],
      drives: 2,
      currentPart: "servers",
      isBuilt: { servers: true, network: true, storage: true, floor: false },
      stepOfPart: { rack: "start", servers: "start", network: "start", storage: "start", floor: "region", power: "sla", calendar: "timing" }
    });
    expect(build.callouts).toEqual([
      { part: "servers", label: "GPUs", value: "16× B300" },
      { part: "network", label: "Network", value: "InfiniBand" },
      { part: "storage", label: "Storage", value: "4 TB/node" }
    ]);
  });

  it("builds custom hardware with its own questions and lights the part being asked", () => {
    const build = setup({ draft: { gpuModel: "h100", gpuCount: 16 }, reached: ["start", "gpu", "interconnect"], current: "interconnect" });

    expect(build).toMatchObject({
      currentPart: "network",
      stepOfPart: { servers: "gpu", network: "interconnect", storage: "storage" },
      isBuilt: { servers: true, network: true, storage: false }
    });
  });

  it("keeps the servers out until a GPU is chosen", () => {
    expect(setup({ draft: { gpuModel: null }, reached: ["start", "gpu"], current: "gpu" })).toMatchObject({
      currentPart: "rack",
      slots: [],
      blankSpans: [],
      isBuilt: { servers: false }
    });
  });

  it("leaves the drives out when no storage is asked for", () => {
    const build = setup({
      draft: { gpuModel: "h100", storageTbPerNode: 0 },
      reached: ["start", "gpu", "interconnect", "region", "storage"],
      current: "storage"
    });

    expect(build).toMatchObject({ drives: 0, isBuilt: { storage: false } });
  });

  it.each([
    ["region", "floor"],
    ["sla", "power"],
    ["timing", "calendar"],
    ["contact", null]
  ] as const)("lights the part for the %s question", (current, part) => {
    expect(setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", current], current }).currentPart).toBe(part);
  });

  it("finishes the room on the review, powered and with every callout in the request card's order", () => {
    const build = setup({
      startingPoint: STARTER_PACKAGES[0],
      draft: { regionMode: "except", areas: ["us", "eu", "apac"], sla: "99.9", term: "12_months", start: "date", startDate: "2026-12-01" },
      reached: ["start"],
      current: "review"
    });

    expect(build).toMatchObject({ isReview: true, isPowered: true, hasUps: true, powerStrips: 2, currentPart: null });
    expect(build.callouts.map(callout => [callout.label, callout.value])).toEqual([
      ["GPUs", "16× B300"],
      ["Network", "InfiniBand"],
      ["Region", "Not US, EU +1"],
      ["Storage", "4 TB/node"],
      ["Uptime", "99.9%"],
      ["Term", "1 yr · Dec 1"]
    ]);
  });

  it.each([
    [{ sla: null }, 1, false, "No SLA"],
    [{ sla: "99" }, 1, false, "99%"],
    [{ sla: "99.5" }, 2, false, "99.5%"]
  ] as const)("powers %o with %i strips", (draft, powerStrips, hasUps, uptime) => {
    const build = setup({ startingPoint: STARTER_PACKAGES[0], draft, reached: ["start"], current: "review" });

    expect(build).toMatchObject({ powerStrips, hasUps });
    expect(build.callouts.find(callout => callout.part === "power")?.value).toBe(uptime);
  });

  it("holds the UPS back until the uptime question is reached", () => {
    expect(setup({ startingPoint: STARTER_PACKAGES[0], draft: { sla: "99.9" }, reached: ["start", "region"], current: "region" })).toMatchObject({
      hasUps: false,
      isPowered: false
    });
  });

  it.each([
    [{ regionMode: "any", areas: [] }, "Anywhere"],
    [{ regionMode: "only", areas: ["eu", "us"] }, "US, EU"],
    [{ regionMode: "only", areas: [] }, "—"],
    [{ fabric: "any" }, "IB or RoCE"],
    [{ fabric: "roce" }, "RoCE"],
    [{ start: "flexible" }, "M2M · Flexible"],
    [{ start: "date", startDate: "" }, "M2M · —"],
    [{ gpuModel: "pro6000", gpuCount: 8 }, "8× PRO 6000"],
    [{ gpuModel: "other", otherGpuModel: "Gaudi 3" }, "8× Gaudi 3"],
    [{ gpuModel: "other", otherGpuModel: " " }, "8× GPU"]
  ] as [Partial<GpuQuoteDraft>, string][])("shows %o as %s in its callout", (draft, value) => {
    const build = setup({ draft: { gpuModel: "h100", ...draft }, reached: ["start"], current: "review" });

    expect(build.callouts.map(callout => callout.value)).toContain(value);
  });

  it.each([
    [{ gpuModel: "pro6000", gpuCount: 72 }, "4u", 8, 4],
    [{ gpuModel: "h100", gpuCount: 24 }, "8u", 3, 8],
    [{ gpuModel: "other", gpuCount: 40 }, "8u", 4, 8]
  ] as const)("racks %o as %s servers, %i of them in the one rack drawn", (draft, kind, servers, units) => {
    const build = setup({ draft, reached: ["start"], current: "review" });

    expect(build.kind).toBe(kind);
    expect(build.slots).toEqual(Array.from({ length: servers }, (_, index) => ({ type: "server", bottomUnit: index * units, units })));
  });

  it("racks a rack-scale GPU as an NVL72: power shelves around compute trays split by switch trays", () => {
    const build = setup({ draft: { gpuModel: "gb300", gpuCount: 144 }, reached: ["start"], current: "review" });

    expect(build.kind).toBe("nvl");
    expect(build.slots.map(slot => `${slot.type}@${slot.bottomUnit}+${slot.units}`).join(" ")).toBe(
      [
        "power@4+2",
        ...[6, 7, 8, 9, 10, 11, 12, 13].map(unit => `compute@${unit}+1`),
        ...[14, 15, 16, 17, 18, 19, 20, 21, 22].map(unit => `switch@${unit}+1`),
        ...[23, 24, 25, 26, 27, 28, 29, 30, 31, 32].map(unit => `compute@${unit}+1`),
        "power@33+2"
      ].join(" ")
    );
    expect(build.blankSpans).toEqual([
      { bottomUnit: 0, units: 4 },
      { bottomUnit: 35, units: 6 }
    ]);
  });

  it("closes every empty unit with a blanking panel, up to the roof until the switch takes the top unit", () => {
    const beforeNetwork = setup({ draft: { gpuModel: "h100", gpuCount: 16 }, reached: ["start", "gpu"], current: "gpu" });
    const withNetwork = setup({ draft: { gpuModel: "h100", gpuCount: 16 }, reached: ["start", "gpu", "interconnect"], current: "interconnect" });

    expect(beforeNetwork.blankSpans).toEqual([{ bottomUnit: 16, units: 26 }]);
    expect(withNetwork.blankSpans).toEqual([{ bottomUnit: 16, units: 25 }]);
  });

  it.each([
    [0, 0],
    [3.84, 1],
    [4, 2],
    [100, 8]
  ])("seats %i TB in %i NVMe drives", (storageTbPerNode, drives) => {
    expect(setup({ draft: { gpuModel: "h100", storageTbPerNode }, reached: ["start"], current: "review" }).drives).toBe(drives);
  });

  it.each([
    ["month_to_month", 1, "MONTHLY"],
    ["3_months", 3, "3 MONTHS"],
    ["6_months", 6, "6 MONTHS"],
    ["12_months", 12, "12 MONTHS"],
    ["24_months", 24, "24 MONTHS"]
  ] as const)("hangs a calendar for a %s term with %i pages headed %s", (term, months, header) => {
    expect(setup({ draft: { term }, reached: ["start"], current: "start" }).calendar).toMatchObject({ months, header });
  });

  it.each([
    ["today for a start as soon as possible", { start: "asap" }, { column: 2, row: 2 }],
    ["today while a dated start has no date yet", { start: "date", startDate: "" }, { column: 2, row: 2 }],
    ["the chosen day in its own month", { start: "date", startDate: "2026-12-01" }, { column: 2, row: 0 }],
    ["a day in a sixth week on the last row", { start: "date", startDate: "2026-08-31" }, { column: 1, row: 4 }],
    ["no day for a flexible start", { start: "flexible", startDate: "2026-12-01" }, null]
  ] as [string, Partial<GpuQuoteDraft>, { column: number; row: number } | null][])("marks %s on the calendar", (_, draft, startCell) => {
    expect(setup({ draft, reached: ["start"], current: "start" }).calendar.startCell).toEqual(startCell);
  });

  function setup(input: { startingPoint?: typeof CUSTOM_STARTING_POINT; draft?: Partial<GpuQuoteDraft>; reached: QuoteStepId[]; current: QuoteStepId }) {
    const startingPoint = input.startingPoint;
    const blank = createBlankDraft("me@example.com");
    const draft = { ...(startingPoint ? applyStartingPoint(blank, startingPoint) : blank), ...input.draft };

    return describeRackBuild({
      steps: listSteps(startingPoint?.answers ?? {}),
      draft,
      reachedSteps: new Set(input.reached),
      currentStep: input.current,
      today: "2026-11-17"
    });
  }
});
