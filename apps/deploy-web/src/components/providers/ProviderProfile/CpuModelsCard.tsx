import type { FC } from "react";
import { Cpu } from "lucide-react";

import { formatCpuName } from "@src/components/providers/providerSummary/providerSummary";
import type { CpuProfile, ProviderCpuModel } from "@src/types/provider";
import { HeaderCell, ProfileCard } from "./ProfileCard";

type Props = {
  models: ProviderCpuModel[];
  profile: CpuProfile;
  unreportedNodeCount?: number;
};

const PROFILE_NOTES: Partial<Record<CpuProfile, string>> = {
  mixed: "The nodes run more than one CPU model, and a deployment can land on any of them.",
  virtual: "The nodes report the CPU their hypervisor emulates, so the physical model is unknown."
};

export const CpuModelsCard: FC<Props> = ({ models, profile, unreportedNodeCount = 0 }) => {
  const note = unreportedNodeCount > 0 ? formatUnreportedNodesNote(unreportedNodeCount) : PROFILE_NOTES[profile];

  return (
    <ProfileCard title="CPU models" aside={note && <span className="font-mono text-[11px] capitalize text-muted-foreground">{profile}</span>}>
      {models.length === 0 && <p className="px-3.5 py-4 text-[12.5px] text-muted-foreground">Unknown. Console has no CPU report for this provider.</p>}

      {models.length > 0 && (
        <>
          <table className="w-full border-collapse" aria-label="CPU models">
            <thead>
              <tr className="bg-muted">
                <HeaderCell>Model</HeaderCell>
                <HeaderCell className="hidden sm:table-cell">Generation</HeaderCell>
                <HeaderCell className="hidden sm:table-cell">Base frequency</HeaderCell>
                <HeaderCell>Threads</HeaderCell>
                <HeaderCell>Nodes</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr key={`${model.vendor}-${model.model}-${model.baseFrequencyMhz}`} className="border-t">
                  <td className="px-3.5 py-[11px]">
                    <span className="flex items-start gap-[7px]">
                      <Cpu className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block break-words text-[13px] font-semibold text-foreground">{formatCpuName(model)}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground sm:hidden">{formatCpuDetails(model)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="hidden px-3.5 py-[11px] font-mono text-xs sm:table-cell">{formatCpuGeneration(model)}</td>
                  <td className="hidden whitespace-nowrap px-3.5 py-[11px] font-mono text-xs text-muted-foreground sm:table-cell">
                    {formatBaseFrequency(model.baseFrequencyMhz)}
                  </td>
                  <td className="px-3.5 py-[11px] font-mono text-xs">{model.threads}</td>
                  <td className="px-3.5 py-[11px] font-mono text-xs">{model.nodeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {note && <p className="border-t px-3.5 py-2.5 text-[11px] text-muted-foreground">{note}</p>}
        </>
      )}
    </ProfileCard>
  );
};

export function formatUnreportedNodesNote(unreportedNodeCount: number): string {
  const nodes = unreportedNodeCount === 1 ? "1 node doesn't" : `${unreportedNodeCount} nodes don't`;
  return `${nodes} report a CPU model, and a deployment can land on ${unreportedNodeCount === 1 ? "it" : "them"}.`;
}

export function formatCpuGeneration({ generation, isVirtual }: Pick<ProviderCpuModel, "generation" | "isVirtual">): string {
  if (isVirtual) return "Virtual";
  return generation ?? "Unknown";
}

export function formatBaseFrequency(baseFrequencyMhz: number | null): string {
  return baseFrequencyMhz === null ? "Not in the name" : `${(baseFrequencyMhz / 1000).toFixed(2)} GHz`;
}

export function formatCpuDetails(model: Pick<ProviderCpuModel, "generation" | "isVirtual" | "baseFrequencyMhz">): string {
  const details = [formatCpuGeneration(model)];
  if (model.baseFrequencyMhz !== null) details.push(formatBaseFrequency(model.baseFrequencyMhz));

  return details.join(" · ");
}
