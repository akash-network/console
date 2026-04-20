import { describe, expect, it } from "vitest";

import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { useFilterHistory } from "./useFilterHistory";

import { act, renderHook } from "@testing-library/react";

describe("useFilterHistory", () => {
  it("initializes with a single snapshot", () => {
    const { result } = setup();

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushes a new snapshot on apply", () => {
    const { result } = setup();

    act(() => {
      result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25);
    });

    expect(result.current.snapshots).toHaveLength(2);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.snapshots[1].resultCount).toBe(25);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("undo restores previous snapshot", () => {
    const { result } = setup();

    act(() => {
      result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25);
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo re-applies after undo", () => {
    const { result } = setup();

    act(() => result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25));
    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("apply after undo discards redo entries", () => {
    const { result } = setup();

    act(() => result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25));
    act(() => result.current.apply(makeFormValues({ cpu: 4 }), makePlacement(), 10));
    act(() => result.current.undo());
    act(() => result.current.apply(makeFormValues({ cpu: 8 }), makePlacement(), 5));

    expect(result.current.snapshots).toHaveLength(3);
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.snapshots[2].resultCount).toBe(5);
  });

  it("caps stack at MAX_SNAPSHOTS (20)", () => {
    const { result } = setup();

    for (let i = 1; i <= 25; i++) {
      act(() => result.current.apply(makeFormValues({ cpu: i }), makePlacement(), i));
    }

    expect(result.current.snapshots.length).toBeLessThanOrEqual(20);
    expect(result.current.currentIndex).toBe(result.current.snapshots.length - 1);
  });

  it("pendingChanges counts differing fields", () => {
    const { result } = setup();

    const changes = result.current.pendingChanges(makeFormValues({ cpu: 2 }), makePlacement());
    expect(changes).toBeGreaterThan(0);
  });

  it("pendingChanges returns 0 when values match snapshot", () => {
    const { result } = setup();

    const changes = result.current.pendingChanges(makeFormValues(), makePlacement());
    expect(changes).toBe(0);
  });

  function makeFormValues(overrides: Record<string, unknown> = {}) {
    return {
      services: [
        {
          id: "test",
          title: "service-1",
          image: "nginx",
          profile: {
            cpu: overrides.cpu ?? 0.5,
            hasGpu: false,
            gpu: 1,
            gpuModels: [{ vendor: "nvidia" }],
            ram: 512,
            ramUnit: "Mi",
            storage: [{ size: 1, unit: "Gi", isPersistent: false }]
          },
          expose: [],
          command: { command: "", arg: "" },
          env: [],
          placement: { name: "dcloud", pricing: { amount: 100000, denom: "uact" }, signedBy: { anyOf: [], allOf: [] }, attributes: [] },
          count: 1
        }
      ]
    } as any;
  }

  function makePlacement(): PlacementFilters {
    return { maxPrice: null, auditedBy: [], regions: [] };
  }

  function setup() {
    return renderHook(() => useFilterHistory(makeFormValues(), makePlacement(), 36));
  }
});
