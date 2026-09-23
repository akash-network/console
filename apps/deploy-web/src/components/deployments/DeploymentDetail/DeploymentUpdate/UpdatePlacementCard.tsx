"use client";
import type { FC } from "react";
import { useState } from "react";
import { MapPin, NavArrowRight, Server } from "iconoir-react";

import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { providerDisplayName } from "@src/utils/providerUtils";
import { foldDetectedGpus, getPlacementGpuModels, getProviderRegion } from "../DeploymentPlacements/placementModel";
import { buildPlacementStats, PlacementStats } from "../DeploymentPlacements/PlacementStats";
import { UpdateServiceSection } from "./UpdateServiceSection";

export interface UpdatePlacementService {
  serviceIndex: number;
  title: string;
}

export interface UpdatePlacementCardProps {
  position: number;
  name: string;
  /** Absent for a placement no live lease backs, such as one of a closed deployment. */
  lease?: LeaseDto;
  provider?: ApiProviderList;
  services: UpdatePlacementService[];
  locked: boolean;
  isLoadingDetectedGpus?: boolean;
}

export const UpdatePlacementCard: FC<UpdatePlacementCardProps> = ({ position, name, lease, provider, services, locked, isLoadingDetectedGpus }) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const region = getProviderRegion(provider);
  const providerName = provider ? providerDisplayName(provider) : undefined;
  const isEverythingCollapsed = services.length > 0 && services.every(service => collapsed.has(service.title));

  function toggleEverything() {
    setCollapsed(isEverythingCollapsed ? new Set() : new Set(services.map(service => service.title)));
  }

  function toggleService(title: string, open: boolean) {
    setCollapsed(current => {
      const next = new Set(current);
      if (open) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <section role="group" aria-label={`Placement ${name}`} className="rounded-xl border bg-card">
      <div className="flex flex-col gap-6 border-b p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">
              {position + 1}
            </div>
            <h3 className="text-2xl font-medium tracking-tight">{name}</h3>
          </div>
          {(region || providerName) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {region && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {region}
                </span>
              )}
              {region && providerName && <NavArrowRight className="h-3 w-3" aria-hidden="true" />}
              {providerName && (
                <span className="inline-flex items-center gap-2">
                  <Server className="h-3 w-3" aria-hidden="true" />
                  {providerName}
                </span>
              )}
            </div>
          )}
        </div>
        {lease && (
          <div className="lg:shrink-0">
            <PlacementStats
              stats={buildPlacementStats(lease, services.length, {
                models: getPlacementGpuModels(lease.group),
                detected: foldDetectedGpus(lease.detectedGpus),
                isLoading: isLoadingDetectedGpus
              })}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Services in this placement</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px]">{services.length}</span>
          </div>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={toggleEverything}>
            {isEverythingCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>
        {services.map(service => (
          <UpdateServiceSection
            key={service.title}
            serviceIndex={service.serviceIndex}
            title={service.title}
            open={!collapsed.has(service.title)}
            onOpenChange={open => toggleService(service.title, open)}
            locked={locked}
          />
        ))}
      </div>
    </section>
  );
};
