import type { ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash";

export type CpuArchAgreement = "match" | "mismatch" | "unknown";

/** Folds the spellings node inventory and self-declared attributes use in the wild onto the two architectures an SDL can request. */
const CPU_ARCH_ALIASES: Record<string, string> = {
  amd64: "amd64",
  x86_64: "amd64",
  "x86-64": "amd64",
  arm64: "arm64",
  aarch64: "arm64",
  "arm-64": "arm64"
};

export function normalizeCpuArch(arch: string | null | undefined): string | null {
  const trimmed = arch?.trim().toLowerCase();
  if (!trimmed) return null;

  return CPU_ARCH_ALIASES[trimmed] ?? trimmed;
}

export function getReportedCpuArchs(nodes: ProviderSnapshotNode[]): string[] {
  const archs = nodes
    .flatMap(node => node.cpus ?? [])
    .map(cpu => normalizeCpuArch(cpu.arch))
    .filter((arch): arch is string => arch !== null);

  return Array.from(new Set(archs)).sort();
}

export function getCpuArchAgreement(declaredCpuArch: string | null, reportedCpuArchs: string[]): CpuArchAgreement {
  const declared = normalizeCpuArch(declaredCpuArch);
  if (!declared || reportedCpuArchs.length === 0) return "unknown";

  return reportedCpuArchs.includes(declared) ? "match" : "mismatch";
}
