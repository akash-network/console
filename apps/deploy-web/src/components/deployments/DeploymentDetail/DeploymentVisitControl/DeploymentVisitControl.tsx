"use client";
import type { FC } from "react";
import { useMemo } from "react";
import {
  Button,
  buttonVariants,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Globe, NavArrowDown } from "iconoir-react";

import { CopyTextToClipboardButton } from "@src/components/shared/CopyTextToClipboardButton";
import { useLeaseStatuses } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import type { VisitEndpoint } from "./visitEndpoints";
import { collectVisitEndpoints, endpointLabel } from "./visitEndpoints";

export const DEPENDENCIES = {
  useLeaseStatuses,
  CopyTextToClipboardButton
};

export interface DeploymentVisitControlProps {
  leases: LeaseDto[];
  providers: ApiProviderList[];
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentVisitControl: FC<DeploymentVisitControlProps> = ({ leases, providers, dependencies: d = DEPENDENCIES }) => {
  const items = useMemo(
    () =>
      leases.filter(isLeaseLive).map(lease => ({
        lease,
        provider: providers.find(provider => provider.owner === lease.provider)
      })),
    [leases, providers]
  );
  const statuses = d.useLeaseStatuses(items, { refetchInterval: 30_000 });
  const endpoints = statuses.flatMap(status => collectVisitEndpoints(status.data));

  return <VisitControlView endpoints={endpoints} CopyTextToClipboardButton={d.CopyTextToClipboardButton} />;
};

const VisitControlView: FC<{
  endpoints: VisitEndpoint[];
  CopyTextToClipboardButton: typeof CopyTextToClipboardButton;
}> = ({ endpoints, CopyTextToClipboardButton }) => {
  if (endpoints.length === 0) return null;

  if (endpoints.length === 1) {
    const endpoint = endpoints[0];
    return (
      <div className="flex items-center gap-2">
        <div className="inline-flex max-w-xs items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Globe className="shrink-0 text-xs text-muted-foreground" />
          <span className="truncate">{endpointLabel(endpoint)}</span>
        </div>
        <CopyTextToClipboardButton value={endpoint.href} aria-label="Copy URL" />
        <a href={endpoint.href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "default", size: "md" }))}>
          Visit
        </a>
      </div>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="md" className="gap-1">
          Visit
          <NavArrowDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-80 rounded-xl p-2">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {endpoints.length} {endpoints.length === 1 ? "endpoint" : "endpoints"}
        </DropdownMenuLabel>
        {endpoints.map(endpoint => (
          <div key={endpoint.href} className="flex items-center gap-1">
            <DropdownMenuItem asChild className="min-w-0 flex-1 cursor-pointer">
              <a href={endpoint.href} target="_blank" rel="noreferrer" className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{endpoint.serviceName}</span>
                <span className="truncate">{endpoint.host}</span>
                <span className="text-muted-foreground">:{endpoint.port}</span>
              </a>
            </DropdownMenuItem>
            <CopyTextToClipboardButton value={endpoint.href} aria-label={`Copy ${endpoint.serviceName} URL`} />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
