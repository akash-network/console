"use client";
import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { ArrowLeft, MapPin, ShieldCheck, Star, TriangleAlert } from "lucide-react";
import Link from "next/link";

import Layout from "@src/components/layout/Layout";
import { formatBytes, formatOptionalUptime, formatProviderLocation, getProviderName, totalOf } from "@src/components/providers/providerSummary/providerSummary";
import { RegionPill } from "@src/components/providers/RegionPill/RegionPill";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import type { ApiProviderDetail } from "@src/types/provider";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { CopyChip } from "./CopyChip";
import { GpuInventoryCard } from "./GpuInventoryCard";
import { LocationCard } from "./LocationCard";
import { OperatorCard } from "./OperatorCard";
import { RawAttributesCard } from "./RawAttributesCard";
import { formatReclamationWindow } from "./reclamationWindow";
import { LeaseTrendCard, UptimeCard } from "./TrendCards";
import { useProviderProfileModel } from "./useProviderProfileModel";
import { YourLeasesCard } from "./YourLeasesCard";

export const DEPENDENCIES = {
  Layout,
  CustomNextSeo,
  useProviderProfileModel,
  GpuInventoryCard,
  LeaseTrendCard,
  UptimeCard,
  YourLeasesCard,
  LocationCard,
  OperatorCard,
  RawAttributesCard
};

const MILLICORES_PER_VCPU = 1000;

type Props = {
  owner: string;
  initialProvider: ApiProviderDetail;
  dependencies?: typeof DEPENDENCIES;
};

export const ProviderProfile: FC<Props> = ({ owner, initialProvider, dependencies: d = DEPENDENCIES }) => {
  const model = d.useProviderProfileModel(owner, initialProvider);
  const { provider } = model;
  const name = getProviderName(provider);
  const location = formatProviderLocation(provider.ipRegion, provider.ipCountryCode);
  const freeVcpuCount = Math.round(provider.stats.cpu.available / MILLICORES_PER_VCPU);
  const freeMemoryBytes = provider.stats.memory.available;

  return (
    <d.Layout disableContainer>
      <d.CustomNextSeo title={`Provider ${name}`} url={`${domainName}${UrlService.providerDetail(owner)}`} />

      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 px-4 pb-9 pt-[22px] md:px-6">
        <Link
          href={UrlService.providers()}
          className="-ml-1 inline-flex items-center gap-1.5 self-start rounded-md py-1 pl-1 pr-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-[13px] w-[13px]" aria-hidden />
          All providers
        </Link>

        <header className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1.5">
            <h1 className="min-w-0 break-words text-[25px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{withBreaksAfterDots(name)}</h1>
            {provider.isAudited && (
              <span className="inline-flex items-center gap-[5px] rounded-full border bg-muted px-[9px] py-[3px] font-mono text-[10.5px] text-foreground">
                <ShieldCheck className="h-[11px] w-[11px] text-emerald-600 dark:text-emerald-400" aria-hidden />
                Audited
              </span>
            )}
            {provider.locationRegion && <RegionPill region={provider.locationRegion} className="px-[9px] py-[3px] text-[10.5px]" />}
            {model.isInactive && (
              <span className="rounded-full bg-warning/15 px-[9px] py-[3px] font-mono text-[10.5px] font-medium text-warning">Inactive</span>
            )}
            <button
              type="button"
              onClick={model.toggleFavorite}
              aria-label={model.isFavorite ? "Remove from favorites" : "Add to favorites"}
              title={model.isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Star className={cn("h-[15px] w-[15px]", model.isFavorite && "fill-amber-400 text-amber-400")} aria-hidden />
            </button>
          </div>
          <div className="mt-[9px] flex flex-wrap items-center gap-x-[7px] gap-y-1.5">
            {location && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11.5px] text-muted-foreground">
                <MapPin className="h-[11px] w-[11px]" aria-hidden />
                {location}
              </span>
            )}
            <CopyChip value={provider.owner} display={`${provider.owner.slice(0, 9)}…${provider.owner.slice(-6)}`} label="Copy provider address" />
            <CopyChip value={provider.hostUri} display={provider.hostUri.replace(/^https?:\/\//, "")} label="Copy provider URI" />
          </div>
        </header>

        {model.isInactive && <InactiveNotice lastOnlineDate={provider.lastOnlineDate} />}

        <div className="grid gap-2.5 sm:grid-cols-3">
          <AvailableNowCard provider={provider} isInactive={model.isInactive} freeVcpuCount={freeVcpuCount} freeMemoryBytes={freeMemoryBytes} />
          <HeadlineCard
            label="Uptime"
            value={formatOptionalUptime(provider.uptime30d)}
            unit="30d"
            foot={`7 days ${formatOptionalUptime(provider.uptime7d)} · 24 hours ${formatOptionalUptime(provider.uptime1d)}`}
          />
          <ReclamationWindowCard reclamationWindow={provider.reclamationWindow} />
        </div>

        <d.GpuInventoryCard
          models={model.gpuModels}
          isLoading={model.isLoadingGpus}
          isProviderOffline={model.isInactive}
          hasGpus={totalOf(provider.stats.gpu) > 0}
          drivers={provider.gpuDrivers ?? []}
          freeVcpuCount={freeVcpuCount}
          freeMemoryBytes={freeMemoryBytes}
        />

        <div className="grid gap-3.5 md:grid-cols-2">
          <d.LeaseTrendCard trend={model.leaseTrend} />
          <d.UptimeCard provider={provider} />
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {model.myLeases.length > 0 && <d.YourLeasesCard leases={model.myLeases} getDeploymentName={model.getDeploymentName} />}
          <d.LocationCard provider={provider} />
          <d.OperatorCard provider={provider} kubeVersion={model.kubeVersion} />
        </div>

        <d.RawAttributesCard attributes={provider.attributes} />
      </div>
    </d.Layout>
  );
};

const AvailableNowCard: FC<{ provider: ApiProviderDetail; isInactive: boolean; freeVcpuCount: number; freeMemoryBytes: number }> = ({
  provider,
  isInactive,
  freeVcpuCount,
  freeMemoryBytes
}) => {
  if (isInactive) return <HeadlineCard label="Available now" value="—" foot="Nothing can be leased while the provider is offline" />;

  if (totalOf(provider.stats.gpu) > 0) {
    const freeGpuCount = provider.stats.gpu.available;
    return (
      <HeadlineCard
        label="Available now"
        value={`${freeGpuCount}× GPU`}
        chip={freeGpuCount === 0 && <AtCapacityChip />}
        foot={`${freeVcpuCount} vCPU · ${formatBytes(freeMemoryBytes)} RAM also free`}
      />
    );
  }

  const freeDiskBytes = provider.stats.storage.ephemeral.available + provider.stats.storage.persistent.available;
  return (
    <HeadlineCard
      label="Available now"
      value={`${freeVcpuCount} vCPU`}
      foot={`${formatBytes(freeMemoryBytes)} RAM · ${formatBytes(freeDiskBytes)} disk free`}
    />
  );
};

const ReclamationWindowCard: FC<{ reclamationWindow: number | null | undefined }> = ({ reclamationWindow }) => {
  if (reclamationWindow === undefined) return <HeadlineCard label="Reclamation window" value="—" foot="Can't be read right now" />;
  if (reclamationWindow === null) return <HeadlineCard label="Reclamation window" value="None" foot="No notice before leased capacity is reclaimed" />;
  return <HeadlineCard label="Reclamation window" value={formatReclamationWindow(reclamationWindow)} foot="Notice before leased capacity is reclaimed" />;
};

type HeadlineCardProps = {
  label: string;
  value: string;
  unit?: string;
  chip?: ReactNode;
  foot: string;
};

const HeadlineCard: FC<HeadlineCardProps> = ({ label, value, unit, chip, foot }) => (
  <section aria-label={label} className="min-w-0 rounded-xl border bg-card px-3.5 pb-[13px] pt-3 shadow-sm">
    <h2 className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</h2>
    <p className="mt-[7px] flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      <span className="whitespace-nowrap text-2xl font-semibold leading-none tracking-[-0.02em] text-foreground">{value}</span>
      {unit && <span className="font-mono text-[11.5px] text-muted-foreground">{unit}</span>}
      {chip}
    </p>
    <p className="mt-1.5 text-[11px] leading-[1.4] text-muted-foreground">{foot}</p>
  </section>
);

const AtCapacityChip: FC = () => (
  <span className="whitespace-nowrap rounded-full bg-amber-500/15 px-[7px] py-0.5 font-mono text-[10.5px] font-semibold text-amber-700 dark:text-amber-500">
    at capacity
  </span>
);

const InactiveNotice: FC<{ lastOnlineDate: string | null }> = ({ lastOnlineDate }) => (
  <div role="status" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-3 text-[12.5px] text-foreground">
    <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-warning" aria-hidden />
    <span>
      This provider is inactive.{" "}
      {lastOnlineDate ? `It last answered Console's checks on ${format(new Date(lastOnlineDate), "MMM d, yyyy")}.` : "It hasn't answered Console's checks."} New
      deployments can&apos;t be placed on it.
    </span>
  </div>
);

function withBreaksAfterDots(name: string): ReactNode[] {
  return name.split(".").flatMap((part, index) => (index === 0 ? [part] : [".", <wbr key={index} />, part]));
}
