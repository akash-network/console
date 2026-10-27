"use client";
import type { FC } from "react";
import { useMemo } from "react";
import { Skeleton } from "@akashnetwork/ui/components";
import { ArrowRight, Terminal } from "lucide-react";

import { CommandBlock } from "@src/components/api-keys/ApiKeyUsageGuide/CommandBlock";
import { useLeaseStatuses } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { SSH_KEY_PERMISSION_COMMAND, SSH_KEY_UNPACK_COMMAND } from "@src/utils/sshKeyInstructions";
import { parseManifestServices } from "../DeploymentPlacements/placementModel";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import type { SshCommand } from "./sshAccess";
import { buildSshCommands, isSshService } from "./sshAccess";

export const DEPENDENCIES = { useLeaseStatuses, CommandBlock };

export interface TemplateGuideLink {
  templateName: string;
  open: () => void;
}

export interface DeploymentGettingStartedProps {
  leases: LeaseDto[];
  providers: ApiProviderList[];
  deploymentManifest: string;
  templateGuide?: TemplateGuideLink;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentGettingStarted: FC<DeploymentGettingStartedProps> = ({
  leases,
  providers,
  deploymentManifest,
  templateGuide,
  dependencies: d = DEPENDENCIES
}) => {
  const manifestServices = useMemo(() => parseManifestServices(deploymentManifest), [deploymentManifest]);
  const runsSsh = Object.values(manifestServices).some(isSshService);
  const liveLeaseItems = useMemo(
    () => (runsSsh ? leases.filter(isLeaseLive).map(lease => ({ lease, provider: providers.find(provider => provider.owner === lease.provider) })) : []),
    [runsSsh, leases, providers]
  );
  const leaseStatuses = d.useLeaseStatuses(liveLeaseItems, { refetchInterval: 30_000 });
  const sshCommands = leaseStatuses.flatMap(({ data }) => (data ? buildSshCommands(manifestServices, data.forwarded_ports) : []));
  const isLoadingSshCommands = leaseStatuses.some(({ isLoading }) => isLoading);

  const showsSsh = sshCommands.length > 0 || isLoadingSshCommands;

  if (!showsSsh && !templateGuide) return null;

  return (
    <section className="mb-8">
      <DeploymentTabHeader title="Getting started" />
      <div className="overflow-hidden rounded-xl border bg-card">
        {showsSsh && (
          <div className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground" aria-hidden>
                <Terminal className="h-4 w-4" />
              </span>
              <h3 className="text-base font-medium">Connect over SSH</h3>
            </div>
            <div className="flex min-w-0 flex-col gap-3 sm:pl-11">
              <p className="text-sm text-muted-foreground">
                In Terminal on macOS or Linux, unpack <code className="font-mono">keypair.zip</code> from your downloads. There is no password.
              </p>
              <p className="text-sm text-muted-foreground">If you deployed with your own key, use its path in the command.</p>
              <d.CommandBlock label="Prepare the SSH key" lines={[SSH_KEY_UNPACK_COMMAND, SSH_KEY_PERMISSION_COMMAND]} />
              {sshCommands.length === 0 ? (
                <Skeleton className="h-10 w-full rounded-lg" data-testid="ssh-command-skeleton" />
              ) : (
                sshCommands.map(sshCommand => (
                  <SshCommandBlock key={sshCommand.command} sshCommand={sshCommand} showsServiceName={sshCommands.length > 1} dependencies={d} />
                ))
              )}
            </div>
          </div>
        )}
        {templateGuide && <TemplateGuideFooter templateGuide={templateGuide} />}
      </div>
    </section>
  );
};

const TemplateGuideFooter: FC<{ templateGuide: TemplateGuideLink }> = ({ templateGuide }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-foreground/[0.025] px-6 py-3 text-sm text-muted-foreground [&:not(:first-child)]:border-t">
    <span>
      From the <strong className="font-semibold text-foreground">{templateGuide.templateName}</strong> template.
    </span>
    <button
      type="button"
      onClick={templateGuide.open}
      className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
    >
      Read the template guide
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </div>
);

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
