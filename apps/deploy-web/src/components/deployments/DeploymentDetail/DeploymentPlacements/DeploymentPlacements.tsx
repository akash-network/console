"use client";
import type { FC } from "react";
import { useMemo } from "react";

import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { PlacementCard } from "./PlacementCard";
import { getPlacementName, getServicesByPlacement, parseManifestServices } from "./placementModel";

export const DEPENDENCIES = { PlacementCard };

export interface DeploymentPlacementsProps {
  leases: LeaseDto[];
  providers: ApiProviderList[];
  deploymentManifest: string;
  dseq: string;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentPlacements: FC<DeploymentPlacementsProps> = ({
  leases,
  providers,
  deploymentManifest,
  dseq,
  onClosed,
  dependencies: d = DEPENDENCIES
}) => {
  const manifestServices = useMemo(() => parseManifestServices(deploymentManifest), [deploymentManifest]);
  const servicesByPlacement = useMemo(() => getServicesByPlacement(deploymentManifest), [deploymentManifest]);

  if (leases.length === 0) {
    return <p className="text-sm text-muted-foreground">{"This deployment doesn't have any active placements."}</p>;
  }

  const serviceCount = Object.keys(manifestServices).length || leases.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3 text-xs font-medium text-muted-foreground">
        <span className="uppercase tracking-wide">Placements</span>
        <span>
          {leases.length} {pluralize("placement", leases.length)} · {serviceCount} {pluralize("service", serviceCount)}
        </span>
      </div>

      {leases.map((lease, index) => (
        <d.PlacementCard
          key={lease.id}
          index={index}
          lease={lease}
          provider={providers.find(provider => provider.owner === lease.provider)}
          manifestServices={manifestServices}
          placementServiceNames={servicesByPlacement[getPlacementName(lease.group, index)]}
          dseq={dseq}
          onClosed={onClosed}
        />
      ))}
    </div>
  );
};

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
