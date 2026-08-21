"use client";
import type { FC } from "react";
import { useMemo } from "react";

import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import { PlacementCard } from "./PlacementCard";
import { countPlacementServices, getPlacementName, parseManifestServices, parseServicesByPlacement } from "./placementModel";

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
  const servicesByPlacement = useMemo(() => parseServicesByPlacement(deploymentManifest), [deploymentManifest]);

  if (leases.length === 0) {
    return <p className="text-sm text-muted-foreground">{"This deployment doesn't have any active placements."}</p>;
  }

  const serviceCount = countPlacementServices(leases, servicesByPlacement, manifestServices);

  return (
    <div>
      <DeploymentTabHeader
        title="Placements"
        actions={
          <span className="text-sm text-muted-foreground">
            {leases.length} {pluralize("placement", leases.length)} · {serviceCount} {pluralize("service", serviceCount)}
          </span>
        }
      />

      {leases.map((lease, index) => (
        <d.PlacementCard
          key={lease.id}
          index={index}
          lease={lease}
          provider={providers.find(provider => provider.owner === lease.provider)}
          manifestServices={manifestServices}
          placementServices={servicesByPlacement[getPlacementName(lease.group, index)]}
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
