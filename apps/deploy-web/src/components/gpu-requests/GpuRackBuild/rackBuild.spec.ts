import { describe, expect, it } from "vitest";

import type { CUSTOM_STARTING_POINT,GpuQuoteDraft, QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import { applyStartingPoint, createBlankDraft, listSteps, STARTER_PACKAGES } from "../gpuQuoteDraft/gpuQuoteDraft";
import { describeRackBuild } from "./rackBuild";

describe(describeRackBuild.name, () => {
  it("starts as an empty rack lit for the first question", () => {
    const build = setup({ reached: ["start"], current: "start" });

    expect(build).toMatchObject({
      serversInRack: 0,
      isPowered: false,
      isReview: false,
      currentPart: "rack",
      callouts: [],
      title: "GPU request",
      readout: "Empty rack",
      isBuilt: { rack: true, servers: false, network: false, storage: false, floor: false, power: false, cage: false }
    });
  });

  it("brings in the hardware a package answers with the package and sends its parts back to the package", () => {
    const build = setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start"], current: "start" });

    expect(build).toMatchObject({
      kind: "8u",
      serversInRack: 2,
      sleds: 2,
      currentPart: "servers",
      title: "Inference fleet",
      readout: "16 GPUs",
      isBuilt: { servers: true, network: true, storage: true, floor: false },
      stepOfPart: { rack: "start", servers: "start", network: "start", storage: "start", floor: "region", power: "sla", cage: "timing" }
    });
    expect(build.callouts).toEqual([
      { part: "network", side: "left", label: "Network", value: "InfiniBand" },
      { part: "storage", side: "left", label: "Storage", value: "4 TB/node" },
      { part: "servers", side: "left", label: "GPUs", value: "16× B300" }
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
    expect(setup({ draft: { gpuModel: null }, reached: ["start", "gpu"], current: "gpu" })).toMatchObject({ currentPart: "rack", isBuilt: { servers: false } });
  });

  it("leaves the drives out when no storage is asked for", () => {
    const build = setup({ draft: { gpuModel: "h100", storageTbPerNode: 0 }, reached: ["start", "gpu", "interconnect", "region", "storage"], current: "storage" });

    expect(build).toMatchObject({ sleds: 0, isBuilt: { storage: false } });
  });

  it.each([
    ["region", "floor"],
    ["sla", "power"],
    ["timing", "cage"],
    ["contact", null]
  ] as const)("lights the part for the %s question", (current, part) => {
    expect(setup({ startingPoint: STARTER_PACKAGES[0], reached: ["start", current], current }).currentPart).toBe(part);
  });

  it("finishes the room on the review, powered and with every callout", () => {
    const build = setup({
      startingPoint: STARTER_PACKAGES[0],
      draft: { regionMode: "except", areas: ["us", "eu", "apac"], sla: "99.9", term: "12_months", start: "date", startDate: "2026-12-01" },
      reached: ["start"],
      current: "review"
    });

    expect(build).toMatchObject({ isReview: true, isPowered: true, hasUps: true, powerStrips: 2, currentPart: null });
    expect(build.callouts.map(callout => [callout.label, callout.value])).toEqual([
      ["Network", "InfiniBand"],
      ["Storage", "4 TB/node"],
      ["GPUs", "16× B300"],
      ["Term", "1 yr · Dec 1"],
      ["Uptime", "99.9%"],
      ["Region", "Not US, EU +1"]
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
    [{ gpuModel: "gb300", gpuCount: 144 }, "nvl", 1, "144 GPUs · 2 racks"],
    [{ gpuModel: "pro6000", gpuCount: 72 }, "4u", 8, "72 GPUs · 2 racks"],
    [{ gpuModel: "h100", gpuCount: 24 }, "8u", 3, "24 GPUs"],
    [{ gpuModel: "other", gpuCount: 40 }, "8u", 4, "40 GPUs · 2 racks"]
  ] as const)("draws %o as %s servers, %i to a rack", (draft, kind, serversInRack, readout) => {
    expect(setup({ draft, reached: ["start"], current: "review" })).toMatchObject({ kind, serversInRack, readout });
  });

  it.each([
    [3.84, 1],
    [4, 2],
    [100, 8]
  ])("seats %i TB in %i NVMe sleds", (storageTbPerNode, sleds) => {
    expect(setup({ draft: { gpuModel: "h100", storageTbPerNode }, reached: ["start"], current: "review" }).sleds).toBe(sleds);
  });

  function setup(input: { startingPoint?: typeof CUSTOM_STARTING_POINT; draft?: Partial<GpuQuoteDraft>; reached: QuoteStepId[]; current: QuoteStepId }) {
    const startingPoint = input.startingPoint;
    const blank = createBlankDraft("me@example.com");
    const draft = { ...(startingPoint ? applyStartingPoint(blank, startingPoint) : blank), ...input.draft };

    return describeRackBuild({
      steps: listSteps(startingPoint?.answers ?? {}),
      draft,
      setupName: startingPoint?.name,
      reachedSteps: new Set(input.reached),
      currentStep: input.current
    });
  }
});
