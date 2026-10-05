"use client";
import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowUpRight, ChevronLeft, ChevronRight, MapPin, ShieldCheck, Star, X } from "lucide-react";
import Link from "next/link";

import type { ProviderSummary } from "@src/components/providers/providerSummary/providerSummary";
import { formatBytes, formatGpuModel, formatUptime, getUptimeQuality } from "@src/components/providers/providerSummary/providerSummary";
import { getRegionTone, REGION_DOT_CLASSES, RegionPill } from "@src/components/providers/RegionPill/RegionPill";
import { UrlService } from "@src/utils/urlUtils";

const UPTIME_QUALITY_LABELS = { excellent: "Excellent", healthy: "Healthy", variable: "Variable" };

type Props = {
  title: string;
  providers: ProviderSummary[];
  selected: ProviderSummary | null;
  favoriteProviders: string[];
  onSelect: (provider: ProviderSummary) => void;
  onBack: () => void;
  onClose: () => void;
  onToggleFavorite: (owner: string) => void;
  className?: string;
};

export const ProviderPanel: FC<Props> = ({ title, providers, selected, favoriteProviders, onSelect, onBack, onClose, onToggleFavorite, className }) => {
  const canGoBack = !!selected && providers.length > 1;
  const isFavorite = !!selected && favoriteProviders.includes(selected.owner);

  return (
    <aside
      aria-label={selected ? `Provider ${selected.name}` : title}
      className={cn(
        "flex flex-col border-border bg-card/95 backdrop-blur-md duration-300 animate-in fade-in-0 slide-in-from-right-8 motion-reduce:animate-none lg:border-l",
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-3">
        {canGoBack && (
          <PanelIconButton label="Back to this location" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </PanelIconButton>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{selected ? selected.name : title}</h2>
        {selected && (
          <PanelIconButton label={isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={() => onToggleFavorite(selected.owner)}>
            <Star className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-400")} />
          </PanelIconButton>
        )}
        <PanelIconButton label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </PanelIconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {selected ? <ProviderDetails provider={selected} /> : <ClusterProviderList providers={providers} onSelect={onSelect} />}
      </div>
    </aside>
  );
};

const ClusterProviderList: FC<{ providers: ProviderSummary[]; onSelect: (provider: ProviderSummary) => void }> = ({ providers, onSelect }) => {
  const gpuCount = providers.reduce((total, provider) => total + provider.gpuCount, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="mb-1 text-[11.5px] leading-normal text-muted-foreground">
        {providers.length} providers here{gpuCount > 0 && ` · ${gpuCount} GPUs`}. Zoom in to separate them on the globe.
      </p>
      <ul className="flex flex-col gap-1.5" aria-label="Providers at this location">
        {providers.map(provider => (
          <li key={provider.owner}>
            <button
              type="button"
              onClick={() => onSelect(provider)}
              className="flex w-full items-center gap-2.5 rounded-[10px] border bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted"
            >
              <span
                className={cn(
                  "h-[7px] w-[7px] shrink-0 rounded-full",
                  provider.locationRegion ? REGION_DOT_CLASSES[getRegionTone(provider.locationRegion)] : "bg-muted-foreground"
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-foreground">{provider.name}</span>
                <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
                  {[provider.location, describeCompute(provider)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProviderDetails: FC<{ provider: ProviderSummary }> = ({ provider }) => (
  <>
    <p className="mb-2 truncate font-mono text-[10.5px] text-muted-foreground" title={provider.owner}>
      {provider.owner}
    </p>
    {(provider.locationRegion || provider.isAudited || !provider.isOnline) && (
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {!provider.isOnline && <span className="rounded-full bg-warning/15 px-2 py-0.5 font-mono text-[10.5px] font-medium text-warning">Offline</span>}
        {provider.locationRegion && <RegionPill region={provider.locationRegion} />}
        {provider.isAudited && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 font-mono text-[10.5px] text-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Audited
          </span>
        )}
      </div>
    )}
    <p className="mb-2.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
      {provider.location ?? "Location unknown"}
    </p>

    <dl className="mb-3 grid grid-cols-2 gap-2">
      <SummaryCard
        label="GPU"
        value={provider.gpuCount > 0 ? `${provider.gpuCount}×` : "—"}
        caption={provider.gpuModels.length > 0 ? provider.gpuModels.map(formatGpuModel).join(", ") : "CPU only"}
      />
      <SummaryCard
        label="Uptime 30d"
        value={provider.uptime30d === null ? "—" : formatUptime(provider.uptime30d)}
        caption={provider.uptime30d === null ? "Not measured yet" : UPTIME_QUALITY_LABELS[getUptimeQuality(provider.uptime30d)]}
      />
      <SummaryCard label="vCPU" value={provider.vcpuCount.toLocaleString("en-US")} caption="Total capacity" />
      <SummaryCard label="Memory" value={formatBytes(provider.memoryBytes)} caption={`${formatBytes(provider.storageBytes)} disk`} />
    </dl>

    <Link
      href={UrlService.providerDetail(provider.owner)}
      className="flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] border bg-background text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
    >
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      View full profile
    </Link>
  </>
);

const SummaryCard: FC<{ label: string; value: string; caption: string }> = ({ label, value, caption }) => (
  <div className="min-w-0 rounded-[10px] border bg-background px-2.5 py-2">
    <dt className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
    <dd className="mt-[3px] truncate text-base font-semibold text-foreground">{value}</dd>
    <dd className="truncate text-[10.5px] text-muted-foreground">{caption}</dd>
  </div>
);

const PanelIconButton: FC<{ label: string; onClick: () => void; children: ReactNode }> = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
  >
    {children}
  </button>
);

function describeCompute(provider: ProviderSummary): string {
  if (provider.gpuCount > 0) {
    const model = provider.gpuModels.length > 0 ? ` ${provider.gpuModels.map(formatGpuModel).join("/")}` : " GPU";
    return `${provider.gpuCount}×${model}`;
  }

  return `${provider.vcpuCount} vCPU`;
}
