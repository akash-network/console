import { describe, expect, it } from "vitest";

import { useConfigureDeployProgress } from "./useConfigureDeployProgress";

import { renderHook } from "@testing-library/react";

describe("useConfigureDeployProgress", () => {
  it("marks creating+matching completed and preparing active while the lease is in flight", () => {
    const { result } = renderHook(() => useConfigureDeployProgress("preparing"));
    expect(result.current.state).toEqual({ kind: "preparing" });
    expect(result.current.phases.map(p => p.status)).toEqual(["completed", "completed", "active"]);
  });

  it("completes every phase and fills the bar once the lease has succeeded", () => {
    const { result } = renderHook(() => useConfigureDeployProgress("success"));
    expect(result.current.state).toEqual({ kind: "success" });
    expect(result.current.phases.map(p => p.status)).toEqual(["completed", "completed", "completed"]);
    expect(result.current.progressPercent).toBe(100);
  });
});
