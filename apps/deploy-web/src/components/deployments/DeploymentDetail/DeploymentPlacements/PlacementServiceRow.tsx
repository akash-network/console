"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Skeleton } from "@akashnetwork/ui/components";
import { Box, Globe, Label, NavArrowDown, NavArrowRight } from "iconoir-react";

import type { ForwardedPort, LeaseServiceStatus, ServiceIp } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import { StatusBadge } from "../DeploymentStatusBadge";
import type { ManifestServiceDetail, ManifestServiceResources } from "./placementModel";
import { formatReplicaCount, getServiceStatus } from "./placementModel";
import type { PlacementStat } from "./PlacementStats";
import { PlacementStats } from "./PlacementStats";
import { PortChips, ServiceUriLinks, toPortChips, toUriLinks } from "./ServiceEndpoints";

export interface PlacementServiceRowProps {
  serviceName: string;
  service?: LeaseServiceStatus;
  leaseState: LeaseDto["state"];
  isReclaimed?: boolean;
  detail?: ManifestServiceDetail;
  uris?: string[] | null;
  forwardedPorts?: ForwardedPort[] | null;
  ips?: ServiceIp[] | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** True while the lease-status poll for a live lease has not settled; endpoint details render as skeleton lines instead of popping in. */
  isLeaseStatusPending?: boolean;
}

export const PlacementServiceRow: FC<PlacementServiceRowProps> = ({
  serviceName,
  service,
  leaseState,
  isReclaimed,
  detail,
  uris,
  forwardedPorts,
  ips,
  open: openProp,
  onOpenChange,
  isLeaseStatusPending
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const status = getServiceStatus(service, leaseState, isReclaimed);
  const closed = status.tone === "closed";
  const uriLinks = closed ? [] : toUriLinks(uris);
  const portChips = toPortChips({ forwardedPorts, ips, closed });
  const replicaLabel = closed ? undefined : formatReplicaCount(service);
  const hasDetails = !!(detail?.resources || detail?.image || uriLinks.length > 0 || portChips.length > 0);
  const showsPendingDetails = !!isLeaseStatusPending && !closed;

  function handleOpenChange(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const identity = (
    <>
      <span className="text-base font-medium">{serviceName}</span>
      <StatusBadge label={status.label} tone={status.tone} />
    </>
  );

  const extras = replicaLabel ? (
    <div className="flex min-w-0 flex-1 items-center justify-end">
      <span className="shrink-0 text-sm text-muted-foreground">{replicaLabel}</span>
    </div>
  ) : showsPendingDetails ? (
    <div className="flex min-w-0 flex-1 items-center justify-end">
      <Skeleton className="h-4 w-24" data-testid="service-replicas-skeleton" />
    </div>
  ) : null;

  if (closed || (!hasDetails && !showsPendingDetails)) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3 p-4">
          <div className="flex items-center gap-3">{identity}</div>
          {extras}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 p-4">
        <CollapsibleTrigger className="flex shrink-0 items-center gap-3 text-left">
          {open ? <NavArrowDown className="h-4 w-4 shrink-0" /> : <NavArrowRight className="h-4 w-4 shrink-0" />}
          {identity}
        </CollapsibleTrigger>
        {extras}
      </div>

      <CollapsibleContent>
        {detail?.resources ? (
          <div className="border-t px-6 py-3">
            <PlacementStats stats={buildServiceStats(detail.resources)} variant="spread" />
          </div>
        ) : null}
        {detail?.image ? (
          <ServiceDetailRow icon={<Box className="h-4 w-4" />} title="Image">
            <span className="break-all">{detail.image}</span>
          </ServiceDetailRow>
        ) : null}
        {uriLinks.length > 0 ? (
          <ServiceDetailRow icon={<Globe className="h-4 w-4" />} title="URL">
            <ServiceUriLinks items={uriLinks} />
          </ServiceDetailRow>
        ) : null}
        {portChips.length > 0 ? (
          <ServiceDetailRow icon={<Label className="h-4 w-4" />} title="Ports">
            <PortChips items={portChips} />
          </ServiceDetailRow>
        ) : null}
        {showsPendingDetails && (
          <div className="space-y-3 border-t px-5 py-4" data-testid="service-details-skeleton">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ServiceDetailRow: FC<{ icon: ReactNode; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-center gap-2 border-t px-5 py-4">
    <span className="shrink-0 text-muted-foreground">{icon}</span>
    <span className="w-32 shrink-0 text-sm font-medium">{title}</span>
    <div className="min-w-0 flex-1 text-left text-sm text-muted-foreground">{children}</div>
  </div>
);

function buildServiceStats(resources: ManifestServiceResources): PlacementStat[] {
  const stats: PlacementStat[] = [
    { label: "vCPU", value: resources.cpu ?? "—" },
    { label: "Memory", value: formatSize(resources.memory) },
    { label: "Storage", value: formatSize(resources.storage) }
  ];
  if (resources.gpuUnits > 0) {
    stats.push({ label: "GPU", value: resources.gpuUnits });
  }
  return stats;
}

function formatSize(size: ManifestServiceResources["memory"]): string {
  return size ? `${size.value} ${size.unit}`.trim() : "—";
}
