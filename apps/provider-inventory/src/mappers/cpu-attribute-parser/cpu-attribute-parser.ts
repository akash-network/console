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

/** Rejects anything the SDL schema would not have produced, so a request no provider could serve fails loudly instead of matching nothing. */
export function parseCPUAttributes(attributes: ResourceAttribute[]): ParsedCPUAttributes {
  let arch: CpuArch | null = null;

  for (const attr of attributes) {
    if (attr.key !== "arch") {
      throw new Error(`Unsupported CPU attribute "${attr.key}"`);
    }

    if (arch) {
      throw new Error(`Duplicate CPU attribute "arch"`);
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

/** Null when a node reports an architecture no request can name, since such a node serves neither amd64 nor arm64. */
export function resolveNodeCpuArch(cpus: readonly CpuInfo[], declaredArch: string | null): CpuArch | null {
  const reported = cpus[0]?.arch;
  if (reported) return normalizeCpuArch(reported);

  return normalizeCpuArch(declaredArch) ?? DEFAULT_CPU_ARCH;
}
