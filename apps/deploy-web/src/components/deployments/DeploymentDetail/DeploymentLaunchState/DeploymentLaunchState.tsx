"use client";
import type { FC } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ChevronRight, MapPin, Server } from "lucide-react";

import type { DeploymentLaunch } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { providerDisplayName } from "@src/utils/providerUtils";
import { DeploymentRecoveryAction } from "../../DeploymentRecoveryAction/DeploymentRecoveryAction";
import { getProviderRegion } from "../DeploymentPlacements/placementModel";

export const DEPENDENCIES = { useProvidersByAddresses, DeploymentRecoveryAction };

const PANEL_CLASS_NAME = "space-y-3 rounded-xl border bg-card p-6";

const UNDELIVERED_DEPLOYMENT_MESSAGE =
  "Its lease exists, but the deployment wasn't sent to its provider. Send it again, or close the deployment in Settings to stop paying for it.";

const LEASE_NOT_CREATED_MESSAGE = "Its lease wasn't created.";

export interface DeploymentLaunchStateProps {
  dseq: string;
  launch: DeploymentLaunch;
  leases: LeaseDto[];
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentLaunchState: FC<DeploymentLaunchStateProps> = ({ dseq, launch, leases, className, dependencies: d = DEPENDENCIES }) => {
  const { data: providers } = d.useProvidersByAddresses(launch.providers);

  if (launch.phase === "failed") {
    return (
      <section aria-label="Deployment failed" className={cn(PANEL_CLASS_NAME, className)}>
        <h3 className="text-lg font-medium">Couldn&apos;t deploy</h3>
        <p className="text-sm text-muted-foreground">{launch.hasLease ? UNDELIVERED_DEPLOYMENT_MESSAGE : launch.reason ?? LEASE_NOT_CREATED_MESSAGE}</p>
        <d.DeploymentRecoveryAction dseq={dseq} hasLease={launch.hasLease} leases={leases} />
      </section>
    );
  }

  return (
    <section aria-label="Deployment spinning up" className={cn(PANEL_CLASS_NAME, className)}>
      <div className="flex items-center gap-3">
        <Spinner size="small" />
        <h3 className="text-lg font-medium">Spinning up</h3>
      </div>
      <p className="text-sm text-muted-foreground">Its services are starting. This page updates on its own once they&apos;re running.</p>
      <ul className="space-y-1.5">
        {launch.providers.map(address => (
          <ProviderLine key={address} address={address} provider={providers.find(provider => provider.owner === address)} />
        ))}
      </ul>
    </section>
  );
};

const ProviderLine: FC<{ address: string; provider: ApiProviderList | undefined }> = ({ address, provider }) => {
  const region = getProviderRegion(provider);

  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {region && (
        <>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            {region}
          </span>
          <ChevronRight className="h-3 w-3" />
        </>
      )}
      <span className="inline-flex items-center gap-2">
        <Server className="h-3 w-3" />
        {provider ? providerDisplayName(provider) : address}
      </span>
    </li>
  );
};
