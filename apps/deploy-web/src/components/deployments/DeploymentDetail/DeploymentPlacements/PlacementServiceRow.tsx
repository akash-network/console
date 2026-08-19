"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Box, Globe, Key, NavArrowDown, NavArrowUp, Terminal } from "iconoir-react";

import { CopyTextToClipboardButton } from "@src/components/shared/CopyTextToClipboardButton";
import type { ForwardedPort, LeaseServiceStatus, ServiceIp } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ManifestEnvVar, ManifestServiceDetail, ManifestServiceResources, ServiceStatusView } from "./placementModel";
import { getServiceStatus } from "./placementModel";
import type { PlacementStat } from "./PlacementStats";
import { PlacementStats } from "./PlacementStats";
import { EndpointLinks, toForwardedPortLinks, toIpLinks, toUriLinks } from "./ServiceEndpoints";

export interface PlacementServiceRowProps {
  serviceName: string;
  service?: LeaseServiceStatus;
  leaseState: LeaseDto["state"];
  isReclaimed?: boolean;
  detail?: ManifestServiceDetail;
  uris?: string[] | null;
  forwardedPorts?: ForwardedPort[] | null;
  ips?: ServiceIp[] | null;
}

export const PlacementServiceRow: FC<PlacementServiceRowProps> = ({ serviceName, service, leaseState, isReclaimed, detail, uris, forwardedPorts, ips }) => {
  const [open, setOpen] = useState(false);
  const status = getServiceStatus(service, leaseState, isReclaimed);
  const endpoints = status.tone === "closed" ? [] : [...toUriLinks(uris), ...toForwardedPortLinks(forwardedPorts), ...toIpLinks(ips)];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center gap-4 p-4 text-left">
        {open ? <NavArrowUp className="h-4 w-4 shrink-0" /> : <NavArrowDown className="h-4 w-4 shrink-0" />}
        <span className="text-base font-medium">{serviceName}</span>
        <ServiceStatusBadge status={status} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        {detail?.resources && (
          <div className="border-t px-6 py-3">
            <PlacementStats stats={buildServiceStats(detail.resources)} />
          </div>
        )}

        <div className="border-t">
          {detail?.image && (
            <ServiceDetailRow icon={<Box className="h-4 w-4" />} title="Docker image">
              <span className="inline-flex items-center gap-2">
                <span className="break-all font-mono">{detail.image}</span>
                <CopyTextToClipboardButton value={detail.image} />
              </span>
            </ServiceDetailRow>
          )}
          {detail?.env && detail.env.length > 0 && (
            <ServiceDetailRow icon={<Key className="h-4 w-4" />} title="Environment Variables">
              <span className="break-all font-mono">{detail.env.map(formatEnvVar).join(", ")}</span>
            </ServiceDetailRow>
          )}
          {detail?.command && (
            <ServiceDetailRow icon={<Terminal className="h-4 w-4" />} title="Commands">
              <span className="break-all font-mono">{detail.command}</span>
            </ServiceDetailRow>
          )}
          <ServiceDetailRow icon={<Globe className="h-4 w-4" />} title="Expose Ports">
            {endpoints.length > 0 ? <EndpointLinks items={endpoints} /> : "None"}
          </ServiceDetailRow>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ServiceDetailRow: FC<{ icon: ReactNode; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-center gap-2 border-t px-5 py-4 first:border-t-0">
    <span className="shrink-0 text-muted-foreground">{icon}</span>
    <span className="w-60 shrink-0 text-base font-semibold">{title}</span>
    <div className="min-w-0 flex-1 text-left text-base text-muted-foreground">{children}</div>
  </div>
);

function buildServiceStats(resources: ManifestServiceResources): PlacementStat[] {
  return [
    { label: "GPU", value: resources.gpuUnits > 0 ? resources.gpuUnits : "--" },
    { label: "vCPU", value: resources.cpu ?? "--" },
    { label: "Memory", value: formatSize(resources.memory) },
    { label: "Storage", value: formatSize(resources.storage) }
  ];
}

function formatSize(size: ManifestServiceResources["memory"]): string {
  return size ? `${size.value} ${size.unit}`.trim() : "--";
}

function formatEnvVar(env: ManifestEnvVar): string {
  return env.value !== undefined ? `${env.key}=${env.value}` : env.key;
}

const STATUS_DOT_CLASS: Record<ServiceStatusView["tone"], string> = {
  running: "bg-emerald-500",
  pending: "bg-amber-500",
  closed: "bg-destructive"
};

const STATUS_TEXT_CLASS: Record<ServiceStatusView["tone"], string> = {
  running: "text-emerald-500",
  pending: "text-amber-500",
  closed: "text-destructive"
};

const ServiceStatusBadge: FC<{ status: ServiceStatusView }> = ({ status }) => (
  <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", STATUS_TEXT_CLASS[status.tone])}>
    <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_CLASS[status.tone])} />
    {status.label}
  </span>
);
