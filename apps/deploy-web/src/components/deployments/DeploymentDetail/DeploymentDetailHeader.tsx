"use client";
import type { FC, ReactNode } from "react";
import { useMemo } from "react";
import { Badge, Button, Card, CardContent, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CheckCircle, EditPencil, InfoCircle } from "iconoir-react";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { ConfidentialComputeBadge } from "@src/components/shared/ConfidentialComputeBadge";
import { CostRate } from "@src/components/shared/CostRate";
import { GpuInterconnectBadge } from "@src/components/shared/GpuInterconnectBadge";
import { TrialDeploymentBadge } from "@src/components/shared/TrialDeploymentBadge";
import { useWallet } from "@src/context/WalletProvider";
import { useDeclaredGpuInterconnect } from "@src/hooks/useDeclaredGpuInterconnect";
import { useDeclaredTeeTypes } from "@src/hooks/useDeclaredTeeTypes";
import { useTickingNow } from "@src/hooks/useTickingNow";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";
import {
  countPlacementServices,
  formatGpuLabel,
  getDeploymentGpuModels,
  parseManifestServices,
  parseServicesByPlacement
} from "./DeploymentPlacements/placementModel";
import { DeploymentVisitControl } from "./DeploymentVisitControl/DeploymentVisitControl";
import { DeploymentStatusBadge } from "./DeploymentStatusBadge";

export const DEPENDENCIES = {
  useLocalNotes,
  useWallet,
  useWalletBalance,
  useDeploymentSettingQuery,
  useDeclaredTeeTypes,
  useDeclaredGpuInterconnect,
  CostRate,
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
  const { balance: walletBalance } = d.useWalletBalance();
  const { data: settings } = d.useDeploymentSettingQuery({ dseq: deployment.dseq });
  const teeTypes = d.useDeclaredTeeTypes(deployment);
  const interconnect = d.useDeclaredGpuInterconnect(deployment);

  const liveLeases = useMemo(() => leases?.filter(isLeaseLive) ?? [], [leases]);
  const costPerBlockUDenom = liveLeases.reduce((sum, lease) => sum + parseFloat(lease.price.amount), 0);
  const liveGpuCount = liveLeases.reduce((sum, lease) => sum + (lease.gpuAmount ?? 0), 0);

  // The detail page never refetches, so the tile's countdown only moves via useTickingNow's minute ticks.
  const runtimeEndsAt = settings?.runtimeEndsAt ?? null;
  const now = useTickingNow(!!runtimeEndsAt);

  const storedDeployment = getDeploymentData(deployment.dseq);
  const storedManifest = storedDeployment?.manifest;
  const manifestServices = useMemo(() => parseManifestServices(storedManifest), [storedManifest]);
  const servicesByPlacement = useMemo(() => parseServicesByPlacement(storedManifest), [storedManifest]);

  const name = getDeploymentName(deployment.dseq) || `Deployment #${deployment.dseq}`;
  const denom = getEscrowDenom(deployment);
  const servicesCount = countPlacementServices(leases ?? [], servicesByPlacement, manifestServices);
  const memory = bytesToShrink(deployment.memoryAmount);
  const storage = bytesToShrink(deployment.storageAmount);

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
        <CardContent className="grid grid-cols-4 gap-x-10 gap-y-5 p-6">
          <SummaryItem label="TOTAL SERVICES">{servicesCount}</SummaryItem>
          <SummaryItem label="COST">
            {costPerBlockUDenom ? <d.CostRate perBlockUDenom={costPerBlockUDenom} denom={denom} gpuCount={liveGpuCount} /> : "—"}
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
          {!!settings?.runtimeLimitHours && (
            <SummaryItem
              label={
                <span className="inline-flex items-center gap-1">
                  RUNTIME LIMIT
                  <d.CustomTooltip title="This deployment stops being funded once its runtime limit is reached, then closes as its remaining funds drain.">
                    <InfoCircle width={12} height={12} className="text-muted-foreground" />
                  </d.CustomTooltip>
                </span>
              }
            >
              {formatRuntimeLimit(settings.runtimeLimitHours, runtimeEndsAt, now)}
            </SummaryItem>
          )}
          <SummaryItem label="GPU">{formatGpuLabel(deployment.gpuAmount ?? 0, getDeploymentGpuModels(deployment.groups))}</SummaryItem>
          <SummaryItem label="vCPU">{roundDecimal(deployment.cpuAmount, 2)}</SummaryItem>
          <SummaryItem label="MEMORY">{`${roundDecimal(memory.value, 2)} ${memory.unit}`}</SummaryItem>
          <SummaryItem label="STORAGE">{`${roundDecimal(storage.value, 2)} ${storage.unit}`}</SummaryItem>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * The runtime-limit tile's value: the requested hours, plus how long remains once the countdown is
 * anchored (it anchors when the lease starts, so a not-yet-leased deployment shows only the hours).
 *
 * The wall clock is read through the `now` parameter rather than `Date.now()` directly. That keeps the
 * output deterministic under fake timers in tests and lets callers stay fresh on pages that never refetch
 * by passing a ticking clock (`useTickingNow`) — without one, the "~Xh left" / "reached" verdict would
 * freeze at first render.
 *
 * @param runtimeLimitHours The limit the user requested, shown as-is (e.g. "12h").
 * @param runtimeEndsAt When funding stops, ISO-encoded; null while the countdown is unanchored, in which
 * case only the limit itself is shown.
 * @param now The instant to measure remaining time against; defaults to the real present.
 */
export function formatRuntimeLimit(runtimeLimitHours: number, runtimeEndsAt: string | null, now: number = Date.now()): string {
  const limit = `${runtimeLimitHours}h`;
  if (!runtimeEndsAt) {
    return limit;
  }
  const hoursRemaining = (new Date(runtimeEndsAt).getTime() - now) / (1000 * 60 * 60);
  if (hoursRemaining <= 0) {
    return `${limit} · reached`;
  }
  return `${limit} · ~${Math.ceil(hoursRemaining)}h left`;
}

const SummaryItem: FC<{ label: ReactNode; children: ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <div className="whitespace-nowrap text-xs font-medium text-muted-foreground">{label}</div>
    <div className="whitespace-nowrap text-sm font-medium">{children}</div>
  </div>
);
