import type { ProviderSnapshotNode, ProviderSnapshotNodeCPU } from "@akashnetwork/database/dbSchemas/akash";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { getCpuArchAgreement, getReportedCpuArchs, normalizeCpuArch } from "./cpu-arch";

describe(normalizeCpuArch.name, () => {
  it.each([
    ["amd64", "amd64"],
    ["x86_64", "amd64"],
    ["X86-64", "amd64"],
    ["arm64", "arm64"],
    ["aarch64", "arm64"],
    [" arm-64 ", "arm64"]
  ])("folds %s onto %s", (input, expected) => {
    expect(normalizeCpuArch(input)).toBe(expected);
  });

  it.each([null, undefined, "", "   "])("returns null for %j", input => {
    expect(normalizeCpuArch(input)).toBeNull();
  });

  it("keeps an unrecognised architecture instead of dropping or defaulting it", () => {
    expect(normalizeCpuArch("RISCV64")).toBe("riscv64");
  });
});

describe(getReportedCpuArchs.name, () => {
  it("returns the distinct normalised architectures across every node, sorted", () => {
    const nodes = [buildNode(["arm64", "aarch64"]), buildNode(["x86_64"]), buildNode(["arm64"])];

    expect(getReportedCpuArchs(nodes)).toEqual(["amd64", "arm64"]);
  });

  it("ignores CPUs that report no architecture", () => {
    const nodes = [buildNode([null, "", "arm64"])];

    expect(getReportedCpuArchs(nodes)).toEqual(["arm64"]);
  });

  it("returns an empty list when no node reports an architecture", () => {
    const nodes = [buildNode([null]), buildNode([])];

    expect(getReportedCpuArchs(nodes)).toEqual([]);
  });

  it("tolerates nodes loaded without their CPUs", () => {
    const nodes = [mock<ProviderSnapshotNode>({ cpus: undefined })];

    expect(getReportedCpuArchs(nodes)).toEqual([]);
  });

  function buildNode(archs: (string | null)[]) {
    return mock<ProviderSnapshotNode>({
      cpus: archs.map(arch => mock<ProviderSnapshotNodeCPU>({ arch }))
    });
  }
});

describe(getCpuArchAgreement.name, () => {
  it("matches when the declared architecture is one the nodes report, whatever the spelling", () => {
    expect(getCpuArchAgreement("arm-64", ["amd64", "arm64"])).toBe("match");
  });

  it("mismatches when the nodes report a different architecture than the one declared", () => {
    expect(getCpuArchAgreement("x86-64", ["arm64"])).toBe("mismatch");
  });

  it("mismatches when the declared value is not an architecture at all", () => {
    expect(getCpuArchAgreement("Zen 4", ["amd64"])).toBe("mismatch");
  });

  it("is unknown when nothing is declared", () => {
    expect(getCpuArchAgreement(null, ["arm64"])).toBe("unknown");
  });

  it("is unknown when the nodes report no architecture", () => {
    expect(getCpuArchAgreement("arm-64", [])).toBe("unknown");
  });
});
