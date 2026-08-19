"use client";
import type { FC, ReactNode } from "react";
import { Badge, Button, buttonVariants, Card, CardContent, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CheckCircle, EditPencil, Globe, InfoCircle } from "iconoir-react";
import Link from "next/link";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { LeaseStatusDto } from "@src/queries/useLeaseQuery";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { hasLiveGpuLease, isLeaseLive } from "@src/utils/leaseUtils";
import { roundDecimal, udenomToDenom } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";
import { DeploymentStatusBadge } from "./DeploymentStatusBadge";

export const DEPENDENCIES = {
  useLocalNotes,
  useWalletBalance,
  useDeploymentSettingQuery,
  useLeaseStatus,
  CustomTooltip
};

export interface DeploymentDetailHeaderProps {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  providers: ApiProviderList[];
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDetailHeader: FC<DeploymentDetailHeaderProps> = ({ deployment, leases, providers, dependencies: d = DEPENDENCIES }) => {
  const { getDeploymentName, changeDeploymentName } = d.useLocalNotes();
  const deploymentCost = leases?.reduce((sum, lease) => sum + parseFloat(lease.price.amount), 0) ?? 0;
  const { balance: walletBalance } = d.useWalletBalance();
  const { data: settings } = d.useDeploymentSettingQuery({ dseq: deployment.dseq });

  const liveLease = leases?.find(isLeaseLive) ?? null;
  const provider = providers.find(p => p.owner === liveLease?.provider) ?? null;
  const { data: leaseStatus } = d.useLeaseStatus({ provider, lease: liveLease, enabled: !!provider });

  const name = getDeploymentName(deployment.dseq) || `Deployment #${deployment.dseq}`;
  const denom = getEscrowDenom(deployment);
  const hasGpu = hasLiveGpuLease(leases);
  const servicesCount = leaseStatus ? Object.keys(leaseStatus.services).length : leases?.length ?? 0;
  const primaryUri = getPrimaryUri(leaseStatus);
  const memory = bytesToShrink(deployment.memoryAmount);
  const storage = bytesToShrink(deployment.storageAmount);

  return (
    <div className="flex flex-col gap-6 py-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <DeploymentStatusBadge state={deployment.state} />
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <Button aria-label="Edit deployment name" variant="ghost" size="icon" onClick={() => changeDeploymentName(deployment.dseq)}>
            <EditPencil className="text-lg" />
          </Button>
        </div>
        {primaryUri && (
          <div className="flex items-center gap-2">
            <div className="inline-flex max-w-xs items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Globe className="shrink-0 text-xs text-muted-foreground" />
              <span className="truncate">{primaryUri}</span>
            </div>
            <Link href={`http://${primaryUri}`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
              Visit
            </Link>
          </div>
        )}
      </div>

      <Card className="w-full shrink-0 lg:w-auto">
        <CardContent className="grid grid-cols-4 gap-x-10 gap-y-5 p-6">
          <SummaryItem label="TOTAL SERVICES">{servicesCount}</SummaryItem>
          <SummaryItem label="COST">
            {deploymentCost ? <PricePerTimeUnit denom={denom} perBlockValue={udenomToDenom(deploymentCost, 10)} showAsHourly={hasGpu} /> : "—"}
          </SummaryItem>
          <SummaryItem label="BALANCE">{walletBalance ? `$${walletBalance.totalUsd.toFixed(2)}` : "—"}</SummaryItem>
          <SummaryItem
            label={
              <span className="inline-flex items-center gap-1">
                AUTO TOP-UP
                <d.CustomTooltip title="Automatically add credits when your balance gets low to keep your deployments running.">
                  <InfoCircle width={12} height={12} className="text-muted-foreground" />
                </d.CustomTooltip>
              </span>
            }
          >
            {settings?.autoTopUpEnabled ? (
              <Badge className="gap-1 rounded-md border-transparent bg-blue-500 px-2 py-0.5 text-white hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-600">
                <CheckCircle width={12} height={12} />
                Active
              </Badge>
            ) : (
              <span className="text-muted-foreground">Off</span>
            )}
          </SummaryItem>
          <SummaryItem label="GPU">{deployment.gpuAmount ? deployment.gpuAmount : "—"}</SummaryItem>
          <SummaryItem label="vCPU">{roundDecimal(deployment.cpuAmount, 2)}</SummaryItem>
          <SummaryItem label="MEMORY">{`${roundDecimal(memory.value, 2)} ${memory.unit}`}</SummaryItem>
          <SummaryItem label="STORAGE">{`${roundDecimal(storage.value, 2)} ${storage.unit}`}</SummaryItem>
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryItem: FC<{ label: ReactNode; children: ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <div className="whitespace-nowrap text-xs font-medium text-muted-foreground">{label}</div>
    <div className="whitespace-nowrap text-sm font-medium">{children}</div>
  </div>
);

function getPrimaryUri(leaseStatus: LeaseStatusDto | null | undefined): string | undefined {
  if (!leaseStatus) return undefined;

  const uri = Object.values(leaseStatus.services).flatMap(service => service.uris ?? [])[0];
  if (uri) return uri;

  const forwarded = Object.values(leaseStatus.forwarded_ports ?? {})
    .flat()
    .find(port => port.host);
  return forwarded ? `${forwarded.host}:${forwarded.externalPort}` : undefined;
}
