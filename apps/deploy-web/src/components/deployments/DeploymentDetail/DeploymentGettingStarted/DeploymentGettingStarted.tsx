"use client";
import type { FC } from "react";
import { useMemo } from "react";
import { Skeleton } from "@akashnetwork/ui/components";
import { Terminal } from "lucide-react";

import { CommandBlock } from "@src/components/api-keys/ApiKeyUsageGuide/CommandBlock";
import { useLeaseStatuses } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { parseManifestServices } from "../DeploymentPlacements/placementModel";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import type { SshCommand } from "./sshAccess";
import { buildSshCommands, isSshService, SSH_PRIVATE_KEY_PATH } from "./sshAccess";

export const DEPENDENCIES = { useLeaseStatuses, CommandBlock };

export interface DeploymentGettingStartedProps {
  leases: LeaseDto[];
  providers: ApiProviderList[];
  deploymentManifest: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentGettingStarted: FC<DeploymentGettingStartedProps> = ({ leases, providers, deploymentManifest, dependencies: d = DEPENDENCIES }) => {
  const manifestServices = useMemo(() => parseManifestServices(deploymentManifest), [deploymentManifest]);
  const runsSsh = Object.values(manifestServices).some(isSshService);
  const liveLeaseItems = useMemo(
    () => (runsSsh ? leases.filter(isLeaseLive).map(lease => ({ lease, provider: providers.find(provider => provider.owner === lease.provider) })) : []),
    [runsSsh, leases, providers]
  );
  const leaseStatuses = d.useLeaseStatuses(liveLeaseItems, { refetchInterval: 30_000 });
  const sshCommands = leaseStatuses.flatMap(({ data }) => (data ? buildSshCommands(manifestServices, data.forwarded_ports) : []));
  const isLoadingSshCommands = leaseStatuses.some(({ isLoading }) => isLoading);

  if (sshCommands.length === 0 && !isLoadingSshCommands) return null;

  return (
    <section className="mb-8">
      <DeploymentTabHeader title="Getting started" />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground" aria-hidden>
            <Terminal className="h-4 w-4" />
          </span>
          <h3 className="text-base font-medium">Connect over SSH</h3>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:pl-11">
          {sshCommands.length === 0 ? (
            <Skeleton className="h-10 w-full rounded-lg" data-testid="ssh-command-skeleton" />
          ) : (
            sshCommands.map(sshCommand => (
              <SshCommandBlock key={sshCommand.command} sshCommand={sshCommand} showsServiceName={sshCommands.length > 1} dependencies={d} />
            ))
          )}
          <p className="text-sm text-muted-foreground">
            Use the private key that matches the public key you deployed with. Replace <code className="font-mono">{SSH_PRIVATE_KEY_PATH}</code> if it lives
            somewhere else.
          </p>
        </div>
      </div>
    </section>
  );
};

const SshCommandBlock: FC<{ sshCommand: SshCommand; showsServiceName: boolean; dependencies: typeof DEPENDENCIES }> = ({
  sshCommand,
  showsServiceName,
  dependencies: d
}) => (
  <div className="flex flex-col gap-1.5">
    {showsServiceName && <span className="text-xs font-medium text-muted-foreground">{sshCommand.serviceName}</span>}
    <d.CommandBlock label={`SSH command for ${sshCommand.serviceName}`} lines={[sshCommand.command]} />
  </div>
);
