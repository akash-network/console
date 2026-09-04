import { describe, expect, it } from "vitest";

import type { CpuInfo } from "../../types/inventory";
import { normalizeCpuArch, parseCPUAttributes, resolveNodeCpuArch } from "./cpu-attribute-parser";

describe(parseCPUAttributes.name, () => {
  it("returns a null architecture when no attributes are declared", () => {
    expect(parseCPUAttributes([]).arch).toBeNull();
  });

  it.each(["amd64", "arm64"])("reads %s off the arch attribute", value => {
    expect(parseCPUAttributes([{ key: "arch", value }]).arch).toBe(value);
  });

  it("rejects an architecture outside the SDL enum", () => {
    expect(() => parseCPUAttributes([{ key: "arch", value: "sparc64" }])).toThrow('Unsupported CPU architecture "sparc64"');
  });

  it("rejects the alias spellings a node may report, since a request must be exact", () => {
    expect(() => parseCPUAttributes([{ key: "arch", value: "aarch64" }])).toThrow('Unsupported CPU architecture "aarch64"');
  });

  it("rejects an attribute key other than arch", () => {
    expect(() => parseCPUAttributes([{ key: "vendor", value: "intel" }])).toThrow('Unsupported CPU attribute "vendor"');
  });
});

describe(normalizeCpuArch.name, () => {
  it.each([
    ["amd64", "amd64"],
    ["x86_64", "amd64"],
    ["x86-64", "amd64"],
    ["X86_64", "amd64"],
    ["  amd64 ", "amd64"],
    ["arm64", "arm64"],
    ["aarch64", "arm64"],
    ["AArch64", "arm64"]
  ])("normalizes %s to %s", (reported, expected) => {
    expect(normalizeCpuArch(reported)).toBe(expected);
  });

  it.each([["sparc64"], [""], [null], [undefined]])("returns null for %s", reported => {
    expect(normalizeCpuArch(reported)).toBeNull();
  });
});

describe(resolveNodeCpuArch.name, () => {
  it("prefers what the node reports over what the provider declares", () => {
    expect(resolveNodeCpuArch([cpuInfo("arm64")], "amd64")).toBe("arm64");
  });

  it("falls back to the declared architecture when the node reports none", () => {
    expect(resolveNodeCpuArch([cpuInfo("")], "arm64")).toBe("arm64");
  });

  it("falls back to the declared architecture when the node reports no CPUs at all", () => {
    expect(resolveNodeCpuArch([], "arm64")).toBe("arm64");
  });

  it("normalizes a declared architecture, which providers write by hand", () => {
    expect(resolveNodeCpuArch([], "aarch64")).toBe("arm64");
  });

  it("defaults to amd64 when neither the node nor the provider says anything", () => {
    expect(resolveNodeCpuArch([], null)).toBe("amd64");
  });

  it("defaults to amd64 when the declared architecture is unrecognized", () => {
    expect(resolveNodeCpuArch([], "sparc64")).toBe("amd64");
  });

  it("reads the first CPU entry, which is the one the provider bid engine checks", () => {
    expect(resolveNodeCpuArch([cpuInfo("arm64"), cpuInfo("amd64")], null)).toBe("arm64");
  });

  function cpuInfo(arch: string): CpuInfo {
    return { vendor: "ampere", model: "altra", arch };
  }
});
