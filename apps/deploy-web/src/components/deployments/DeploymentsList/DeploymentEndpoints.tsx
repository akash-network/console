"use client";
import type { FC } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown, OpenInWindow } from "iconoir-react";

import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import type { UnreachableReason } from "./useDeploymentReachability";

const UNREACHABLE_LABELS: Record<UnreachableReason, string> = {
  "not-running": "no endpoint · not running",
  "provider-unreachable": "endpoints unavailable · provider unreachable",
  "no-public-endpoint": "private · no public endpoint"
};

export interface DeploymentEndpointsProps {
  endpoints: VisitEndpoint[];
  isLoading: boolean;
  unreachableReason: UnreachableReason | null;
  className?: string;
}

export const DeploymentEndpoints: FC<DeploymentEndpointsProps> = ({ endpoints, isLoading, unreachableReason, className }) => {
  if (isLoading) {
    return <Skeleton className={cn("h-5 w-40", className)} data-testid="deployment-endpoints-skeleton" />;
  }

  if (endpoints.length === 0) {
    return <p className={cn("truncate text-sm text-muted-foreground", className)}>{unreachableReason ? UNREACHABLE_LABELS[unreachableReason] : ""}</p>;
  }

  if (endpoints.length === 1) {
    return <EndpointLink endpoint={endpoints[0]} className={className} />;
  }

  return (
    <Collapsible className={className}>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        {endpoints.length} endpoints
        <NavArrowDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1">
        {endpoints.map(endpoint => (
          <EndpointLink key={endpoint.href} endpoint={endpoint} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

const EndpointLink: FC<{ endpoint: VisitEndpoint; className?: string }> = ({ endpoint, className }) => (
  <a
    href={endpoint.href}
    target="_blank"
    rel="noreferrer"
    onClick={event => event.stopPropagation()}
    className={cn("group grid grid-cols-[minmax(0,4rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm", className)}
  >
    <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{endpoint.serviceName}</span>
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate group-hover:underline">{endpoint.host}</span>
      <OpenInWindow className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </span>
    <span className="text-muted-foreground">:{endpoint.port}</span>
  </a>
);
