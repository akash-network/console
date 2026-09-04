import type { CpuInfo, ResourceAttribute } from "../../types/inventory";

export const CPU_ARCHITECTURES = ["amd64", "arm64"] as const;

export type CpuArch = (typeof CPU_ARCHITECTURES)[number];

/** The architecture a request that names none is screened as, matching the default the provider bid engine applies. */
export const DEFAULT_CPU_ARCH: CpuArch = "amd64";

const ARCH_ALIASES: Record<string, CpuArch> = {
  amd64: "amd64",
  x86_64: "amd64",
  "x86-64": "amd64",
  arm64: "arm64",
  aarch64: "arm64"
};

export interface ParsedCPUAttributes {
  arch: CpuArch | null;
}

/**
 * Reads a requested architecture off a group spec's CPU attributes, rejecting anything the SDL schema
 * would not have produced so a request no provider could serve fails loudly instead of matching nothing.
 */
export function parseCPUAttributes(attributes: ResourceAttribute[]): ParsedCPUAttributes {
  let arch: CpuArch | null = null;

  for (const attr of attributes) {
    if (attr.key !== "arch") {
      throw new Error(`Unsupported CPU attribute "${attr.key}"`);
    }

    const requested = CPU_ARCHITECTURES.find(candidate => candidate === attr.value);
    if (!requested) {
      throw new Error(`Unsupported CPU architecture "${attr.value}"`);
    }

    arch = requested;
  }

  return { arch };
}

/** Accepts the spellings inventory and provider attributes use in the wild, unlike a requested architecture which must be exact. */
export function normalizeCpuArch(arch: string | null | undefined): CpuArch | null {
  if (!arch) return null;
  return ARCH_ALIASES[arch.trim().toLowerCase()] ?? null;
}

/**
 * The architecture a node runs: what its inventory reports, else what its provider declares on chain,
 * else amd64 — every node predating architecture reporting runs it.
 */
export function resolveNodeCpuArch(cpus: readonly CpuInfo[], declaredArch: string | null): CpuArch {
  return normalizeCpuArch(cpus[0]?.arch) ?? normalizeCpuArch(declaredArch) ?? DEFAULT_CPU_ARCH;
}
