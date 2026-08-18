"use client";
import type { FC } from "react";
import { MapPin, NavArrowRight, Server } from "iconoir-react";

import { useTeeResourceCarveouts } from "@src/hooks/useTeeResourceCarveouts";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getGroupTeeType } from "@src/utils/confidentialCompute";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { providerDisplayName } from "@src/utils/providerUtils";
import { isProviderReclaimed } from "@src/utils/reclamationUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { ConfidentialComputeResources } from "../../ConfidentialComputeResources";
import { DownloadAttestationEvidence } from "../../DownloadAttestationEvidence";
import { ReclamationCard } from "../../ReclamationCard/ReclamationCard";
import type { ManifestServiceDetail } from "./placementModel";
import { getPlacementGpuModels, getPlacementName, getProviderRegion } from "./placementModel";
import { PlacementServiceRow } from "./PlacementServiceRow";
import type { PlacementStat } from "./PlacementStats";
import { PlacementStats } from "./PlacementStats";

export const DEPENDENCIES = {
  useLeaseStatus,
  useTeeResourceCarveouts,
  ReclamationCard,
  ConfidentialComputeResources,
  DownloadAttestationEvidence,
  PlacementServiceRow
};

export interface PlacementCardProps {
  index: number;
  lease: LeaseDto;
  provider?: ApiProviderList;
  manifestServices: Record<string, ManifestServiceDetail>;
  placementServiceNames?: string[];
  dseq: string;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const PlacementCard: FC<PlacementCardProps> = ({
  index,
  lease,
  provider,
  manifestServices,
  placementServiceNames,
  dseq,
  onClosed,
  dependencies: d = DEPENDENCIES
}) => {
  const isLeaseActive = isLeaseLive(lease);
  const { data: leaseStatus } = d.useLeaseStatus({ provider, lease, enabled: isLeaseActive && !!provider, refetchInterval: 30_000 });
  const carveouts = d.useTeeResourceCarveouts(lease);

  const isReclaimed = isProviderReclaimed(lease);
  const teeType = getGroupTeeType(lease.group);
  const name = getPlacementName(lease.group, index);
  const region = getProviderRegion(provider);
  const gpuModels = getPlacementGpuModels(lease.group);
  const serviceNames = leaseStatus ? Object.keys(leaseStatus.services) : placementServiceNames ?? Object.keys(manifestServices);
  const providerName = provider ? providerDisplayName(provider) : undefined;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-6 border-b p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <h3 className="text-2xl font-medium tracking-tight">{name}</h3>
          {(region || providerName) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {region && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {region}
                </span>
              )}
              {region && providerName && <NavArrowRight className="h-3 w-3" />}
              {providerName && (
                <span className="inline-flex items-center gap-2">
                  <Server className="h-3 w-3" />
                  {providerName}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="w-full lg:max-w-2xl">
          <PlacementStats stats={buildPlacementStats(lease, serviceNames.length, gpuModels)} />
        </div>
      </div>

      {(isReclaimed || carveouts.length > 0 || (isLeaseActive && !!provider && !!teeType)) && (
        <div className="space-y-4 px-6 pt-6">
          {isReclaimed && <d.ReclamationCard lease={lease} dseq={dseq} onClosed={onClosed} />}
          <d.ConfidentialComputeResources carveouts={carveouts} />
          <d.DownloadAttestationEvidence lease={lease} provider={provider} />
        </div>
      )}

      <div className="space-y-2 p-6">
        {serviceNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services found for this placement.</p>
        ) : (
          serviceNames.map(serviceName => (
            <d.PlacementServiceRow
              key={serviceName}
              serviceName={serviceName}
              service={leaseStatus?.services?.[serviceName]}
              leaseState={lease.state}
              isReclaimed={isReclaimed}
              detail={manifestServices[serviceName]}
              uris={leaseStatus?.services?.[serviceName]?.uris}
              forwardedPorts={leaseStatus?.forwarded_ports?.[serviceName]}
              ips={leaseStatus?.ips?.[serviceName]}
            />
          ))
        )}
      </div>
    </div>
  );
};

function buildPlacementStats(lease: LeaseDto, serviceCount: number, gpuModels: string[]): PlacementStat[] {
  const memory = bytesToShrink(lease.memoryAmount);
  const storage = bytesToShrink(lease.storageAmount);

  return [
    { label: "Services", value: serviceCount },
    { label: "GPU", value: formatGpu(lease.gpuAmount, gpuModels) },
    { label: "vCPU", value: roundDecimal(lease.cpuAmount, 2) },
    { label: "Memory", value: `${roundDecimal(memory.value, 2)} ${memory.unit}` },
    { label: "Storage", value: `${roundDecimal(storage.value, 2)} ${storage.unit}` }
  ];
}

function formatGpu(gpuAmount: number | undefined, gpuModels: string[]): string | number {
  if (!gpuAmount || gpuAmount <= 0) return "--";
  return gpuModels.length > 0 ? gpuModels.map(model => model.toUpperCase()).join(", ") : gpuAmount;
}
