import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useDeploymentName";
import { deploymentLabelOf, useDeploymentName } from "./useDeploymentName";

import { renderHook } from "@testing-library/react";

describe(useDeploymentName.name, () => {
  it("uses the name the card already has without looking one up", () => {
    const { result, useDeploymentNames } = setup({ dseq: "42", knownName: "blog", lookedUpName: "other" });

    expect(result.current).toBe("blog");
    expect(useDeploymentNames).toHaveBeenCalledWith([]);
  });

  it.each([undefined, null, ""])("looks up the name when the card has %j", knownName => {
    const { result, useDeploymentNames, getDeploymentName } = setup({ dseq: "42", knownName, lookedUpName: "web" });

    expect(result.current).toBe("web");
    expect(useDeploymentNames).toHaveBeenCalledWith(["42"]);
    expect(getDeploymentName).toHaveBeenCalledWith("42");
  });

  it("returns no name for a deployment nobody named", () => {
    const { result } = setup({ dseq: "42", lookedUpName: null });

    expect(result.current).toBeNull();
  });

  it("looks nothing up without a deployment", () => {
    const { result, useDeploymentNames } = setup({ dseq: null });

    expect(result.current).toBeNull();
    expect(useDeploymentNames).toHaveBeenCalledWith([]);
  });

  describe(deploymentLabelOf.name, () => {
    it("names the deployment, or calls it this deployment when it has no name", () => {
      expect(deploymentLabelOf("blog")).toBe("blog");
      expect(deploymentLabelOf(null)).toBe("this deployment");
      expect(deploymentLabelOf("")).toBe("this deployment");
    });
  });

  function setup(input: { dseq: string | null; knownName?: string | null; lookedUpName?: string | null }) {
    const getDeploymentName = vi.fn((dseq: string | number | null | undefined) => (dseq ? (input.lookedUpName ?? null) : null));
    const useDeploymentNames = vi.fn<typeof DEPENDENCIES.useDeploymentNames>(() => ({ getDeploymentName, isLoading: false }));
    const { result } = renderHook(() => useDeploymentName(input.dseq, input.knownName, { useDeploymentNames }));

    return { result, useDeploymentNames, getDeploymentName };
  }
});
