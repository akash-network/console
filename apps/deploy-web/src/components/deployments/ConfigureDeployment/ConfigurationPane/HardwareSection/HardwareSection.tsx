import type { FC } from "react";
import { CollapsibleCard } from "@akashnetwork/ui/components";
import { CpuIcon } from "lucide-react";

import { computeResourcesTooltip } from "../cardTooltips";
import { ComputeResourcesCard } from "../ComputeResourcesCard/ComputeResourcesCard";

export const DEPENDENCIES = {
  CollapsibleCard,
  ComputeResourcesCard
};

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "HARDWARE" section of the Configuration pane for the selected service.
 * Each card edits `services.${serviceIndex}.profile.*` on the shared deployment
 * model.
 */
export const HardwareSection: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Hardware</p>
      <div className="flex flex-col gap-4">
        <d.CollapsibleCard title="Compute Resources" icon={<CpuIcon className="h-4 w-4" />} infoTooltip={computeResourcesTooltip}>
          <d.ComputeResourcesCard serviceIndex={serviceIndex} />
        </d.CollapsibleCard>
      </div>
    </div>
  );
};
