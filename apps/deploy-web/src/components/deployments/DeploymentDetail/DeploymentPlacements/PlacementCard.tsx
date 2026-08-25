"use client";
import type { FC } from "react";
import { useState } from "react";
import { MapPin, NavArrowRight, Server } from "iconoir-react";
import Link from "next/link";

import { useTeeResourceCarveouts } from "@src/hooks/useTeeResourceCarveouts";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { isProviderUnavailableError } from "@src/services/query-error-policy/query-error-policy";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getGroupTeeType } from "@src/utils/confidentialCompute";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { providerDisplayName } from "@src/utils/providerUtils";
import { isProviderReclaimed, isReclaiming } from "@src/utils/reclamationUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { UrlService } from "@src/utils/urlUtils";
import { ConfidentialComputeResources } from "../../ConfidentialComputeResources";
import { DownloadAttestationEvidence } from "../../DownloadAttestationEvidence";
import { ReclamationCard } from "../../ReclamationCard/ReclamationCard";
import { StatusBadge } from "../DeploymentStatusBadge";
import type { ManifestServiceDetail } from "./placementModel";
import { formatGpuLabel, getPlacementGpuModels, getPlacementName, getProviderRegion } from "./placementModel";
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
  placementServices?: Record<string, ManifestServiceDetail>;
  dseq: string;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const PlacementCard: FC<PlacementCardProps> = ({
  index,
  lease,
  provider,
  manifestServices,
  placementServices,
  dseq,
  onClosed,
  dependencies: d = DEPENDENCIES
}) => {
  const isLeaseActive = isLeaseLive(lease);
  const {
    data: leaseStatus,
    error: leaseStatusError,
    isPending
  } = d.useLeaseStatus({ provider, lease, enabled: isLeaseActive && !!provider, refetchInterval: 30_000 });
  /** Raw isPending stays true forever for a disabled query (closed lease, unknown provider), so mirror the enabled gate. */
  const isLeaseStatusPending = isLeaseActive && !!provider && isPending;
  const isProviderUnreachable = isLeaseActive && isProviderUnavailableError(leaseStatusError);
  const carveouts = d.useTeeResourceCarveouts(lease);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const isReclaimed = isProviderReclaimed(lease);
  const teeType = getGroupTeeType(lease.group);
  const name = getPlacementName(lease.group, index);
  const region = getProviderRegion(provider);
  const gpuModels = getPlacementGpuModels(lease.group);
  const services = placementServices ?? manifestServices;
  const serviceNames = leaseStatus ? Object.keys(leaseStatus.services) : Object.keys(services);
  const providerName = provider ? providerDisplayName(provider) : undefined;
  const allExpanded = serviceNames.length > 0 && serviceNames.every(serviceName => expanded.has(serviceName));

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(serviceNames));
  }

  function handleOpenChange(serviceName: string, next: boolean) {
    setExpanded(current => {
      const nextSet = new Set(current);
      if (next) nextSet.add(serviceName);
      else nextSet.delete(serviceName);
      return nextSet;
    });
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-6 border-b p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div
              aria-label={`Placement ${index + 1}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground"
            >
              {index + 1}
            </div>
            <h3 className="text-2xl font-medium tracking-tight">{name}</h3>
            {isReclaiming(lease) && <StatusBadge label="Reclaiming" tone="warning" />}
            {isProviderUnreachable && <StatusBadge label="Provider not responding" tone="warning" />}
          </div>
          {(region || providerName) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {region && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {region}
                </span>
              )}
              {region && providerName && <NavArrowRight className="h-3 w-3" />}
              {providerName && provider && (
                <Link href={UrlService.providerDetail(provider.owner)} className="inline-flex items-center gap-2 hover:text-foreground">
                  <Server className="h-3 w-3" />
                  {providerName}
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="lg:shrink-0">
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

      <div className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Services in this placement</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px]">{serviceNames.length}</span>
          </div>
          {isLeaseActive && !isReclaimed && serviceNames.length > 0 && (
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={toggleAll}>
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        {serviceNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services found for this placement.</p>
        ) : (
          <div className="space-y-2">
            {serviceNames.map(serviceName => (
              <d.PlacementServiceRow
                key={serviceName}
                serviceName={serviceName}
                service={leaseStatus?.services?.[serviceName]}
                leaseState={lease.state}
                isReclaimed={isReclaimed}
                detail={services[serviceName]}
                uris={leaseStatus?.services?.[serviceName]?.uris}
                forwardedPorts={leaseStatus?.forwarded_ports?.[serviceName]}
                ips={leaseStatus?.ips?.[serviceName]}
                isLeaseStatusPending={isLeaseStatusPending}
                open={expanded.has(serviceName)}
                onOpenChange={next => handleOpenChange(serviceName, next)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function buildPlacementStats(lease: LeaseDto, serviceCount: number, gpuModels: string[]): PlacementStat[] {
  const memory = bytesToShrink(lease.memoryAmount);
  const storage = bytesToShrink(lease.storageAmount);
  const stats: PlacementStat[] = [
    { label: "vCPU", value: roundDecimal(lease.cpuAmount, 2) },
    { label: "Memory", value: `${roundDecimal(memory.value, 2)} ${memory.unit}` },
    { label: "Storage", value: `${roundDecimal(storage.value, 2)} ${storage.unit}` }
  ];
  if (lease.gpuAmount && lease.gpuAmount > 0) {
    stats.push({ label: "GPU", value: formatGpuLabel(lease.gpuAmount, gpuModels) });
  }
  stats.push({ label: "Services", value: serviceCount });
  return stats;
}
