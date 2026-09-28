import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { CpuIcon, GpuIcon, HardDriveIcon, MemoryStickIcon } from "lucide-react";

import type { DeploymentResourceKind } from "./deploymentResources";
import { useDeploymentResourceSummary } from "./useDeploymentResourceSummary";

export const DEPENDENCIES = { useDeploymentResourceSummary };

const RESOURCE_ICONS: Record<DeploymentResourceKind, LucideIcon> = {
  cpu: CpuIcon,
  gpu: GpuIcon,
  memory: MemoryStickIcon,
  storage: HardDriveIcon,
  persistent: HardDriveIcon
};

type Props = {
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentResourceSummary: FC<Props> = ({ className, dependencies: d = DEPENDENCIES }) => {
  const segments = d.useDeploymentResourceSummary();

  if (segments.length === 0) return null;

  return (
    <ul aria-label="Deployment resources" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {segments.map(segment => {
        const Icon = RESOURCE_ICONS[segment.kind];
        return (
          <li key={segment.kind} className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {segment.label}
          </li>
        );
      })}
    </ul>
  );
};
