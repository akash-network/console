"use client";
import * as React from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { Info } from "lucide-react";

import type { TeeResourceCarveout } from "@src/utils/confidentialCompute";
import { MIN_PRIMARY_CPU_MILLICORES, MIN_PRIMARY_MEMORY_BYTES } from "@src/utils/confidentialCompute";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";

export type Props = {
  carveouts: TeeResourceCarveout[];
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = { CustomTooltip };

const formatCpu = (millicores: number) => `${roundDecimal(millicores / 1000, 2)} CPU`;

const formatMemory = (bytes: number) => {
  const { value, unit } = bytesToShrink(bytes, true);
  return `${roundDecimal(value, 2)} ${unit}`;
};

/** Self-describing label for a resource unit (on-chain groups carry no service names). */
const formatUnitLabel = (carveout: TeeResourceCarveout) => {
  const parts = [formatCpu(carveout.requested.cpu), formatMemory(carveout.requested.memory)];
  if (carveout.gpuUnits > 0) parts.push(`${carveout.gpuUnits} GPU`);
  return parts.join(" · ");
};

function ResourceLine({ label, cpu, memory }: { label: string; cpu: number; memory: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        <span>{formatCpu(cpu)}</span>
        <span>{formatMemory(memory)}</span>
      </span>
    </div>
  );
}

export function ConfidentialComputeResources({ carveouts, dependencies: d = DEPENDENCIES }: Props) {
  if (carveouts.length === 0) return null;

  const multiple = carveouts.length > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-sm font-medium">
        <span>Confidential compute resources</span>
        <d.CustomTooltip title="The provider injects an attestation sidecar that reserves part of the resources you declared. You still pay for the full declared amount — the reserved slice is taken from what your container can use, not from your bill.">
          <Info className="h-3 w-3 cursor-help text-muted-foreground" />
        </d.CustomTooltip>
      </div>

      {carveouts.map(carveout => {
        // When the declared budget is at/below the sidecar footprint the provider applies a minimum
        // for the primary container, so the rows are no longer a clean subtraction — explain that.
        const isConstrained =
          carveout.requested.cpu - carveout.reserved.cpu < MIN_PRIMARY_CPU_MILLICORES ||
          carveout.requested.memory - carveout.reserved.memory < MIN_PRIMARY_MEMORY_BYTES;

        return (
          <div key={carveout.id} className="space-y-1 rounded-md border p-3">
            {(multiple || carveout.count > 1) && (
              <div className="flex items-center justify-between gap-4 text-sm font-medium">
                <span>{multiple ? formatUnitLabel(carveout) : null}</span>
                {carveout.count > 1 && <span className="text-xs text-muted-foreground">× {carveout.count} replicas</span>}
              </div>
            )}
            <ResourceLine label="Requested" cpu={carveout.requested.cpu} memory={carveout.requested.memory} />
            <ResourceLine label="Attestation sidecar" cpu={carveout.reserved.cpu} memory={carveout.reserved.memory} />
            <ResourceLine label="Available to your container" cpu={carveout.container.cpu} memory={carveout.container.memory} />
            {isConstrained && (
              <p className="text-xs text-muted-foreground">
                These declared resources are at or below the attestation sidecar&apos;s reservation, so the provider applies a minimum for your container — the
                values above are not a direct subtraction. Consider increasing the declared CPU and memory.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
