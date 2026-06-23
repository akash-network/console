"use client";
import * as React from "react";
import { Badge, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Info } from "lucide-react";

import type { TeeType } from "@src/utils/confidentialCompute";
import { formatTeeTypeLabel } from "@src/utils/confidentialCompute";

export type Props = {
  teeTypes: TeeType[];
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  Badge,
  CustomTooltip
};

export function ConfidentialComputeBadge({ teeTypes, className, dependencies: d = DEPENDENCIES }: Props) {
  if (teeTypes.length === 0) return null;

  const label = teeTypes.length === 1 ? `Confidential Compute (${formatTeeTypeLabel(teeTypes[0])})` : "Confidential Compute";

  return (
    <d.CustomTooltip
      title={
        <div className="max-w-xs space-y-2 text-sm">
          <p>
            One or more services in this deployment are configured to run in a Trusted Execution Environment (TEE), keeping their memory encrypted and isolated
            from the provider. Confidentiality depends on the provider honoring the request and passing attestation.
          </p>
          <p>The provider automatically injects an attestation sidecar that reserves a small slice of the resources you declared.</p>
          {teeTypes.length > 1 && <p>Declared types: {teeTypes.map(formatTeeTypeLabel).join(", ")}.</p>}
        </div>
      }
    >
      <div className="inline-flex items-center gap-1">
        <d.Badge variant="secondary" className={cn("inline-flex cursor-help items-center gap-1", className)}>
          <span>{label}</span>
          <Info className="h-3 w-3" />
        </d.Badge>
      </div>
    </d.CustomTooltip>
  );
}
