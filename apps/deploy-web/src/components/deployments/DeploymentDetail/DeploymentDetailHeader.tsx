"use client";
import type { FC, ReactNode } from "react";
import { useMemo } from "react";
import { Button, Card, CardContent, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { EditPencil, InfoCircle } from "iconoir-react";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { ConfidentialComputeBadge } from "@src/components/shared/ConfidentialComputeBadge";
import { CostBreakdownTooltip } from "@src/components/shared/CostBreakdownTooltip";
import { CostRate } from "@src/components/shared/CostRate";
import { GpuInterconnectBadge } from "@src/components/shared/GpuInterconnectBadge";
import { TrialDeploymentBadge } from "@src/components/shared/TrialDeploymentBadge";
import { useWallet } from "@src/context/WalletProvider";
import { useDeclaredGpuInterconnect } from "@src/hooks/useDeclaredGpuInterconnect";
import { useDeclaredTeeTypes } from "@src/hooks/useDeclaredTeeTypes";
import { useDeploymentEscrowBalance } from "@src/hooks/useDeploymentEscrowBalance/useDeploymentEscrowBalance";
import { useHasDeploymentStopped } from "@src/hooks/useHasDeploymentStopped";
import { useTickingNow } from "@src/hooks/useTickingNow";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { getRuntimeLimitCountdown } from "@src/utils/runtimeLimitUtils";
import { formatByteSize } from "@src/utils/unitUtils";
import {
  countPlacementServices,
  formatGpuLabel,
  getDeploymentGpuModels,
  parseManifestServices,
  parseServicesByPlacement
} from "./DeploymentPlacements/placementModel";
import { DeploymentVisitControl } from "./DeploymentVisitControl/DeploymentVisitControl";
import { DeploymentStatusBadge } from "./DeploymentStatusBadge";
import { RuntimeLimitMeter } from "./RuntimeLimitMeter";

export const DEPENDENCIES = {
  useLocalNotes,
  useWallet,
  useDeploymentEscrowBalance,
  useDeploymentSettingQuery,
  useDeclaredTeeTypes,
  useDeclaredGpuInterconnect,
  CostRate,
  CostBreakdownTooltip,
  DeploymentVisitControl,
  CustomTooltip,
  ConfidentialComputeBadge,
  GpuInterconnectBadge,
  TrialDeploymentBadge
};

/**
 * Renaming is a secondary affordance, so the pencil stays out of the way until the title row is hovered. Where hover
 * does not exist (touch) it stays visible, and keyboard focus reveals it everywhere. `opacity` rather than
 * `visibility`, which would drop the button out of the tab order and make the focus rule unreachable.
 */
const HOVER_REVEALED = "transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100";

export interface DeploymentDetailHeaderProps {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  providers: ApiProviderList[];
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDetailHeader: FC<DeploymentDetailHeaderProps> = ({ deployment, leases, providers, dependencies: d = DEPENDENCIES }) => {
  const { getDeploymentName, changeDeploymentName, getDeploymentData } = d.useLocalNotes();
  const { isTrialing } = d.useWallet();
  const { denom } = d.useDeploymentEscrowBalance({ deployment, leases });
  const { data: settings } = d.useDeploymentSettingQuery({ dseq: deployment.dseq, pollUntilRuntimeAnchored: true });
  const teeTypes = d.useDeclaredTeeTypes(deployment);
  const interconnect = d.useDeclaredGpuInterconnect(deployment);

  const liveLeases = useMemo(() => leases?.filter(isLeaseLive) ?? [], [leases]);
  const costPerBlockUDenom = liveLeases.reduce((sum, lease) => sum + parseFloat(lease.price.amount), 0);
  const liveGpuCount = liveLeases.reduce((sum, lease) => sum + (lease.gpuAmount ?? 0), 0);

  const hasStopped = useHasDeploymentStopped({ deployment, leases });
  const runtimeEndsAt = settings?.runtimeEndsAt ?? null;
  const now = useTickingNow(!!runtimeEndsAt && !hasStopped);
  const runtimeLimitCountdown = settings?.runtimeLimitHours
    ? getRuntimeLimitCountdown({ runtimeLimitHours: settings.runtimeLimitHours, runtimeEndsAt, hasStopped, now })
    : null;

  const storedDeployment = getDeploymentData(deployment.dseq);
  const storedManifest = storedDeployment?.manifest;
  const manifestServices = useMemo(() => parseManifestServices(storedManifest), [storedManifest]);
  const servicesByPlacement = useMemo(() => parseServicesByPlacement(storedManifest), [storedManifest]);

  const name = getDeploymentName(deployment.dseq) || `Deployment #${deployment.dseq}`;
  const servicesCount = countPlacementServices(leases ?? [], servicesByPlacement, manifestServices);

  return (
    <div className="flex flex-col gap-6 py-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <DeploymentStatusBadge state={deployment.state} leases={leases} />
          <d.ConfidentialComputeBadge teeTypes={teeTypes} />
          <d.GpuInterconnectBadge interconnect={interconnect} />
          {isTrialing && <d.TrialDeploymentBadge createdHeight={deployment.createdAt} />}
        </div>
        <div className="group flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <Button
            aria-label="Edit deployment name"
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", HOVER_REVEALED)}
            onClick={() => changeDeploymentName(deployment.dseq)}
          >
            <EditPencil className="h-4 w-4" />
          </Button>
        </div>
        <d.DeploymentVisitControl leases={leases ?? []} providers={providers} />
      </div>

      <Card className="w-full shrink-0 lg:w-auto">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="grid grid-cols-4 gap-x-10">
            <SummaryItem label="TOTAL SERVICES">{servicesCount}</SummaryItem>
            <SummaryItem
              label={
                <span className="inline-flex items-center gap-1">
                  COST
                  {!!costPerBlockUDenom && (
                    <d.CostBreakdownTooltip perBlockUDenom={costPerBlockUDenom} denom={denom} gpuCount={liveGpuCount}>
                      <InfoCircle width={12} height={12} className="text-muted-foreground" />
                    </d.CostBreakdownTooltip>
                  )}
                </span>
              }
            >
              {costPerBlockUDenom ? <d.CostRate perBlockUDenom={costPerBlockUDenom} denom={denom} gpuCount={liveGpuCount} hideBreakdownTooltip /> : "—"}
            </SummaryItem>
            {runtimeLimitCountdown && (
              <SummaryItem
                label={
                  <span className="inline-flex items-center gap-1">
                    RUNTIME LIMIT
                    <d.CustomTooltip title="This deployment closes automatically once its runtime limit is reached. Unused funds are returned to your balance.">
                      <InfoCircle width={12} height={12} className="text-muted-foreground" />
                    </d.CustomTooltip>
                  </span>
                }
              >
                <div className="min-w-24 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{runtimeLimitCountdown.remainingLabel}</span>
                    {runtimeLimitCountdown.status !== "unanchored" && (
                      <span className="text-xs font-normal text-muted-foreground">{runtimeLimitCountdown.limitLabel}</span>
                    )}
                  </div>
                  <RuntimeLimitMeter countdown={runtimeLimitCountdown} />
                </div>
              </SummaryItem>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-10">
            <SummaryItem label="GPU">{formatGpuLabel(deployment.gpuAmount ?? 0, getDeploymentGpuModels(deployment.groups))}</SummaryItem>
            <SummaryItem label="vCPU">{roundDecimal(deployment.cpuAmount, 2)}</SummaryItem>
            <SummaryItem label="MEMORY">{formatByteSize(deployment.memoryAmount)}</SummaryItem>
            <SummaryItem label="STORAGE">{formatByteSize(deployment.storageAmount)}</SummaryItem>
          </div>
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
