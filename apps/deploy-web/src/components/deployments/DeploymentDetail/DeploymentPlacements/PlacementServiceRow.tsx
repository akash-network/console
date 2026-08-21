"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { Label, NavArrowDown, NavArrowRight } from "iconoir-react";

import type { ForwardedPort, LeaseServiceStatus, ServiceIp } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import { StatusBadge } from "../DeploymentStatusBadge";
import { formatReplicaCount, getServiceStatus } from "./placementModel";
import { PortChips, ServiceUriLinks, toPortChips, toUriLinks } from "./ServiceEndpoints";

export interface PlacementServiceRowProps {
  serviceName: string;
  service?: LeaseServiceStatus;
  leaseState: LeaseDto["state"];
  isReclaimed?: boolean;
  uris?: string[] | null;
  forwardedPorts?: ForwardedPort[] | null;
  ips?: ServiceIp[] | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const PlacementServiceRow: FC<PlacementServiceRowProps> = ({
  serviceName,
  service,
  leaseState,
  isReclaimed,
  uris,
  forwardedPorts,
  ips,
  open: openProp,
  onOpenChange
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const status = getServiceStatus(service, leaseState, isReclaimed);
  const closed = status.tone === "closed";
  const uriLinks = closed ? [] : toUriLinks(uris);
  const portChips = toPortChips({ forwardedPorts, ips, closed });
  const replicaLabel = formatReplicaCount(service);
  const expandable = portChips.length > 0;

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

  const extras = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <ServiceUriLinks items={uriLinks} />
      {replicaLabel ? <span className="ml-auto shrink-0 text-sm text-muted-foreground">{replicaLabel}</span> : null}
    </div>
  );

  if (!expandable) {
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
        <div className="border-t">
          <ServiceDetailRow icon={<Label className="h-4 w-4" />} title="Ports">
            <PortChips items={portChips} />
          </ServiceDetailRow>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ServiceDetailRow: FC<{ icon: ReactNode; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-center gap-2 px-5 py-4">
    <span className="shrink-0 text-muted-foreground">{icon}</span>
    <span className="w-32 shrink-0 text-base font-semibold">{title}</span>
    <div className="min-w-0 flex-1 text-left text-base text-muted-foreground">{children}</div>
  </div>
);
