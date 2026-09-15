"use client";
import type { FC } from "react";
import { Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowUpRight, NavArrowDown } from "iconoir-react";

import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import type { UnreachableReason } from "./useDeploymentReachability";

const UNREACHABLE_LABELS: Record<UnreachableReason, string> = {
  "not-running": "no endpoint · not running",
  "provider-unreachable": "endpoints unavailable · provider unreachable",
  "no-public-endpoint": "private · no public endpoint"
};

const EndpointParts: FC<{ endpoint: VisitEndpoint }> = ({ endpoint }) => (
  <>
    <span className="shrink-0 truncate uppercase text-muted-foreground">{endpoint.serviceName}</span>
    <span className="truncate group-hover:underline">{endpoint.host}</span>
    <span className="shrink-0 text-muted-foreground">:{endpoint.port}</span>
  </>
);

export interface DeploymentEndpointsProps {
  endpoints: VisitEndpoint[];
  isLoading: boolean;
  unreachableReason: UnreachableReason | null;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  className?: string;
}

export const DeploymentEndpoints: FC<DeploymentEndpointsProps> = ({ endpoints, isLoading, unreachableReason, isExpanded, onToggleExpanded, className }) => {
  if (isLoading) {
    return <Skeleton className={cn("h-5 w-40", className)} data-testid="deployment-endpoints-skeleton" />;
  }

  if (endpoints.length === 0) {
    return (
      <p className={cn("truncate font-mono text-xs text-muted-foreground", className)}>{unreachableReason ? UNREACHABLE_LABELS[unreachableReason] : ""}</p>
    );
  }

  if (endpoints.length === 1) {
    const endpoint = endpoints[0];
    return (
      <a
        href={endpoint.href}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className={cn("group inline-flex max-w-full items-center gap-1 font-mono text-xs", className)}
      >
        <EndpointParts endpoint={endpoint} />
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="sr-only">opens in a new tab</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={onToggleExpanded}
      className={cn("group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground", className)}
    >
      {endpoints.length} endpoints
      <NavArrowDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
    </button>
  );
};

/** Spans the table rather than the endpoint column, so a long host reads on one line instead of wrapping inside a quarter of the row. */
export const DeploymentEndpointsPanel: FC<{ endpoints: VisitEndpoint[] }> = ({ endpoints }) => (
  <div className="space-y-1.5 rounded-md bg-muted/50 px-4 py-3">
    {endpoints.map(endpoint => (
      <a
        key={endpoint.href}
        href={endpoint.href}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="group grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_auto] items-baseline gap-3 font-mono text-xs"
      >
        <EndpointParts endpoint={endpoint} />
        <span className="sr-only">opens in a new tab</span>
      </a>
    ))}
  </div>
);
