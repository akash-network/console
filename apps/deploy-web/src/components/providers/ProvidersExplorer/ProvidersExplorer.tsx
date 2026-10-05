"use client";
import type { FC, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@akashnetwork/ui/hooks";
import { cn } from "@akashnetwork/ui/utils";
import { useReducedMotion } from "framer-motion";
import { Globe as GlobeIcon, Minus, Play, Plus, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import dynamic from "next/dynamic";

import { NetworkStats } from "@src/components/providers/NetworkStats/NetworkStats";
import { ProviderPanel } from "@src/components/providers/ProviderPanel/ProviderPanel";
import type { GlobeCluster, GlobeProvider } from "@src/components/providers/ProvidersGlobe/clusterProviders";
import type { ProvidersGlobeHandle } from "@src/components/providers/ProvidersGlobe/ProvidersGlobe";
import { GpuFilterPopover, RegionFilterPopover } from "@src/components/providers/ProvidersTable/ProviderFilterPopover";
import { ProvidersTable } from "@src/components/providers/ProvidersTable/ProvidersTable";
import type { ProviderSummary } from "@src/components/providers/providerSummary/providerSummary";
import { summarizeListedProvider, summarizeLocatedProvider } from "@src/components/providers/providerSummary/providerSummary";
import useCookieTheme from "@src/hooks/useTheme";
import { useProvidersExplorerModel } from "./useProvidersExplorerModel";

const ProvidersGlobe = dynamic(() => import("@src/components/providers/ProvidersGlobe/ProvidersGlobe").then(module => module.ProvidersGlobe), {
  ssr: false
});

export const DEPENDENCIES = {
  useProvidersExplorerModel,
  useTheme: useCookieTheme,
  useMediaQuery,
  useReducedMotion,
  ProvidersGlobe,
  NetworkStats,
  ProviderPanel,
  ProvidersTable,
  RegionFilterPopover,
  GpuFilterPopover
};

const WIDE_LAYOUT_QUERY = "(min-width: 1024px)";
/** Moves the globe left by this many world units so the open panel doesn't cover it. */
const PANEL_OPEN_GLOBE_SHIFT = -0.42;
const ZOOM_STEP = 0.42;
const CLUSTER_CAMERA_DISTANCE = 2.6;
const PROVIDER_CAMERA_DISTANCE = 2.35;

type PanelState = {
  title: string;
  providers: ProviderSummary[];
  selected: ProviderSummary | null;
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ProvidersExplorer: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const model = d.useProvidersExplorerModel();
  const theme = d.useTheme() === "dark" ? "dark" : "light";
  const isWide = d.useMediaQuery(WIDE_LAYOUT_QUERY);
  const prefersReducedMotion = !!d.useReducedMotion();
  const globeControls = useRef<ProvidersGlobeHandle>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [introKey, setIntroKey] = useState(0);
  const [isIntroSettled, setIsIntroSettled] = useState(false);
  const [isHeroEngaged, setIsHeroEngaged] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState<GlobeCluster | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [isGlobeUnavailable, setIsGlobeUnavailable] = useState(false);

  const locatedProviders = useMemo(() => new Map(model.locations.map(location => [location.owner, summarizeLocatedProvider(location)])), [model.locations]);
  const globeProviders = useMemo(() => [...locatedProviders.values()].flatMap(toGlobeProvider), [locatedProviders]);
  const tableProviders = useMemo(() => model.providers.map(summarizeListedProvider), [model.providers]);
  const countryCount = useMemo(
    () => new Set(model.locations.flatMap(location => (location.ipCountryCode ? [location.ipCountryCode] : []))).size,
    [model.locations]
  );
  const selectedOwner = panel?.selected?.owner ?? null;

  const openCluster = useCallback(
    (cluster: GlobeCluster) => {
      const providers = cluster.providerIds.flatMap(owner => locatedProviders.get(owner) ?? []);
      setPanel({ title: cluster.label, providers, selected: providers.length === 1 ? providers[0] : null });
      globeControls.current?.focus(cluster.lat, cluster.lng, CLUSTER_CAMERA_DISTANCE);
    },
    [locatedProviders]
  );

  const openProvider = useCallback(
    (provider: ProviderSummary) => {
      setPanel({ title: provider.location ?? provider.name, providers: [provider], selected: provider });
      if (provider.coordinates && locatedProviders.has(provider.owner)) {
        globeControls.current?.focus(provider.coordinates.lat, provider.coordinates.lng, PROVIDER_CAMERA_DISTANCE);
      }
      heroRef.current?.scrollIntoView?.({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    },
    [locatedProviders, prefersReducedMotion]
  );

  const selectFromPanel = useCallback((provider: ProviderSummary) => {
    setPanel(current => current && { ...current, selected: provider });
    if (provider.coordinates) globeControls.current?.focus(provider.coordinates.lat, provider.coordinates.lng, PROVIDER_CAMERA_DISTANCE);
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
    globeControls.current?.resetView();
  }, []);

  const resetView = useCallback(() => {
    setPanel(null);
    globeControls.current?.resetView();
  }, []);

  const replayIntro = useCallback(() => {
    setIsIntroSettled(false);
    setIntroKey(key => key + 1);
  }, []);

  const searchField = <SearchField value={model.search} onChange={model.changeSearch} className={isWide ? "w-[236px]" : "w-full"} />;
  const regionFilter = (
    <d.RegionFilterPopover
      options={model.regionOptions}
      selected={model.filters.regions}
      onChange={regions => model.updateFilters({ regions })}
      variant={isWide ? "header" : "toolbar"}
    />
  );
  const gpuFilter = (
    <d.GpuFilterPopover
      options={model.gpuModelOptions}
      selected={model.filters.gpuModels}
      isGpuOnly={model.filters.isGpuOnly}
      onChange={model.updateFilters}
      variant={isWide ? "header" : "toolbar"}
    />
  );

  return (
    <div className="flex flex-col gap-[18px] px-4 pb-8 pt-5 md:px-6">
      <section
        ref={heroRef}
        aria-label="Provider map"
        onMouseEnter={() => setIsHeroEngaged(true)}
        onMouseLeave={() => setIsHeroEngaged(false)}
        className={cn(
          "relative scroll-mt-5 overflow-hidden rounded-2xl border bg-[radial-gradient(120%_88%_at_50%_10%,hsl(var(--card))_0%,color-mix(in_oklab,hsl(var(--foreground))_4%,hsl(var(--card)))_58%,color-mix(in_oklab,hsl(var(--foreground))_8%,hsl(var(--card)))_100%)] shadow-sm lg:h-[400px] dark:bg-[radial-gradient(120%_88%_at_50%_12%,color-mix(in_oklab,hsl(var(--foreground))_6%,hsl(var(--card)))_0%,hsl(var(--background))_72%)]",
          panel ? "h-[440px]" : "h-[340px]"
        )}
      >
        {isGlobeUnavailable ? (
          <GlobeUnavailableNotice />
        ) : (
          <d.ProvidersGlobe
            controlsRef={globeControls}
            providers={globeProviders}
            activeIds={model.matchingLocationIds}
            selectedId={selectedOwner}
            theme={theme}
            introKey={introKey}
            playIntro={!prefersReducedMotion}
            dim={isIntroSettled && !isHeroEngaged && !panel}
            shiftX={panel && isWide ? PANEL_OPEN_GLOBE_SHIFT : 0}
            onPick={openCluster}
            onHover={setHoveredCluster}
            onIntroDone={() => setIsIntroSettled(true)}
            onZoomChange={setZoomLevel}
            onUnavailable={() => setIsGlobeUnavailable(true)}
            className="absolute inset-0"
          />
        )}

        {isWide && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[360px] bg-gradient-to-r from-card/90 via-card/60 to-transparent" aria-hidden />
        )}

        <div className="pointer-events-none absolute left-4 top-3.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-[7px] rounded-full border border-border bg-card/80 px-2.5 py-[5px] backdrop-blur-md">
            <span className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" aria-hidden />
            <span className="whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase tracking-[0.07em] text-foreground">Live network</span>
          </span>
          {model.locations.length > 0 && (
            <span className="hidden whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:inline">
              {model.locations.length} providers · {countryCount} countries
            </span>
          )}
        </div>

        {model.hasFailedToLoadLocations && (
          <div className="absolute left-4 top-12 z-[5] flex items-center gap-2 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur-md">
            <span role="alert">Couldn&apos;t load the provider map.</span>
            <button
              type="button"
              onClick={() => model.retryLocations()}
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Retry
            </button>
          </div>
        )}

        {(!panel || isWide) && (
          <div
            className={cn(
              "absolute right-4 top-3 z-[5] flex items-center gap-2 transition-transform duration-300 ease-out motion-reduce:transition-none",
              panel && "-translate-x-[348px]"
            )}
          >
            {isWide && (
              <>
                {searchField}
                <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
              </>
            )}
            {!isGlobeUnavailable && (
              <div className="flex items-center gap-[5px]">
                <OverlayIconButton label="Zoom in" onClick={() => globeControls.current?.zoomBy(-ZOOM_STEP)} disabled={zoomLevel > 0.96}>
                  <Plus className="h-3.5 w-3.5" />
                </OverlayIconButton>
                <OverlayIconButton label="Zoom out" onClick={() => globeControls.current?.zoomBy(ZOOM_STEP)} disabled={zoomLevel < 0.04}>
                  <Minus className="h-3.5 w-3.5" />
                </OverlayIconButton>
                <OverlayIconButton label="Reset view" onClick={resetView}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </OverlayIconButton>
                {!prefersReducedMotion && (
                  <OverlayIconButton label="Replay intro" onClick={replayIntro}>
                    <Play className="h-3.5 w-3.5" />
                  </OverlayIconButton>
                )}
              </div>
            )}
          </div>
        )}

        {hoveredCluster && !panel && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-[18px] z-[5] max-w-[268px] rounded-[10px] border border-border bg-card/90 px-[11px] py-2 backdrop-blur-md",
              isWide ? "left-[258px]" : "left-4"
            )}
          >
            <span className="block text-[12.5px] font-semibold text-foreground">{hoveredCluster.label}</span>
            <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">{describeCluster(hoveredCluster)} · click to open</span>
          </div>
        )}

        {!isGlobeUnavailable && !hoveredCluster && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-[18px] right-4 z-[5] transition duration-300 ease-out",
              panel && isWide && "-translate-x-[348px]",
              isIntroSettled && !isHeroEngaged && !panel ? "opacity-0" : "opacity-100"
            )}
          >
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/85 px-[9px] py-1 font-mono text-[10.5px] text-muted-foreground backdrop-blur-md">
              <Search className="h-[11px] w-[11px]" aria-hidden />
              {describeZoom(zoomLevel)} · drag to spin
            </span>
          </div>
        )}

        {isWide && <d.NetworkStats stats={model.networkStats} layout="column" className="absolute bottom-4 left-4 z-[4] w-[218px]" />}

        {panel && (
          <d.ProviderPanel
            title={panel.title}
            providers={panel.providers}
            selected={panel.selected}
            favoriteProviders={model.favoriteProviders}
            onSelect={selectFromPanel}
            onBack={() => setPanel(current => current && { ...current, selected: null })}
            onClose={closePanel}
            onToggleFavorite={model.toggleFavorite}
            className={cn("absolute z-[6]", isWide ? "inset-y-0 right-0 w-[348px]" : "inset-0")}
          />
        )}
      </section>

      {!isWide && <d.NetworkStats stats={model.networkStats} layout="row" />}

      <section aria-labelledby="providers-table-heading" className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3 pt-2">
          <h2 id="providers-table-heading" className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            {model.hasFilters ? "Matching providers" : "All providers"}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip label="Active" isOn={model.filters.isActiveOnly} onToggle={() => model.updateFilters({ isActiveOnly: !model.filters.isActiveOnly })} />
            <FilterChip
              label="Audited"
              isOn={model.filters.isAuditedOnly}
              onToggle={() => model.updateFilters({ isAuditedOnly: !model.filters.isAuditedOnly })}
            />
            <FilterChip
              label="Favorites"
              isOn={model.filters.isFavoritesOnly}
              onToggle={() => model.updateFilters({ isFavoritesOnly: !model.filters.isFavoritesOnly })}
            />
            {model.hasLoadedProviders && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {model.matchingProviderCount} {model.matchingProviderCount === 1 ? "provider" : "providers"}
              </span>
            )}
            {model.hasFilters && (
              <button
                type="button"
                onClick={model.clearFilters}
                className="ml-1 rounded-full border px-[9px] py-[3px] text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {!isWide && (
          <div className="mb-3 flex flex-col gap-2">
            {searchField}
            <div className="flex items-center gap-2">
              {regionFilter}
              {gpuFilter}
            </div>
          </div>
        )}

        <d.ProvidersTable
          providers={tableProviders}
          status={model.hasFailedToLoadProviders ? "failed" : model.hasLoadedProviders ? "ready" : "loading"}
          matchingProviderCount={model.matchingProviderCount}
          pageIndex={model.pageIndex}
          pageCount={model.pageCount}
          onPageChange={model.changePageIndex}
          selectedOwner={selectedOwner}
          onSelect={openProvider}
          favoriteProviders={model.favoriteProviders}
          onToggleFavorite={model.toggleFavorite}
          onRetry={model.retryProviders}
          isCompact={!isWide}
          regionFilter={regionFilter}
          gpuFilter={gpuFilter}
        />
      </section>
    </div>
  );
};

const SearchField: FC<{ value: string; onChange: (value: string) => void; className?: string }> = ({ value, onChange, className }) => (
  <label className={cn("inline-flex h-8 items-center gap-[7px] rounded-[9px] border border-border bg-card/90 px-2.5 backdrop-blur-md", className)}>
    <Search className="h-[13px] w-[13px] shrink-0 text-muted-foreground" aria-hidden />
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder="Search name, host or address…"
      aria-label="Search providers"
      className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
    />
    {value && (
      <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="inline-flex text-muted-foreground hover:text-foreground">
        <X className="h-[13px] w-[13px]" />
      </button>
    )}
  </label>
);

const OverlayIconButton: FC<{ label: string; onClick: () => void; disabled?: boolean; children: ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border bg-card/85 text-foreground backdrop-blur-md transition-colors hover:bg-card disabled:cursor-default disabled:opacity-40"
  >
    {children}
  </button>
);

const FilterChip: FC<{ label: string; isOn: boolean; onToggle: () => void }> = ({ label, isOn, onToggle }) => (
  <button
    type="button"
    aria-pressed={isOn}
    onClick={onToggle}
    className="inline-flex h-[26px] items-center whitespace-nowrap rounded-lg border px-[9px] text-[11.5px] font-medium text-muted-foreground transition-colors aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background hover:text-foreground"
  >
    {label}
  </button>
);

const GlobeUnavailableNotice: FC = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
    <GlobeIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
    <p className="text-sm text-muted-foreground">The globe can&apos;t be shown in this browser. The providers are listed below.</p>
  </div>
);

function toGlobeProvider(provider: ProviderSummary): GlobeProvider[] {
  if (!provider.coordinates) return [];
  return [
    {
      id: provider.owner,
      lat: provider.coordinates.lat,
      lng: provider.coordinates.lng,
      location: provider.location,
      gpuCount: provider.gpuCount,
      vcpuCount: provider.vcpuCount
    }
  ];
}

function describeCluster(cluster: GlobeCluster): string {
  const providerCount = cluster.providerIds.length;
  const providers = `${providerCount} ${providerCount === 1 ? "provider" : "providers"}`;
  return cluster.gpuCount > 0 ? `${providers} · ${cluster.gpuCount} GPUs` : providers;
}

function describeZoom(zoomLevel: number): string {
  if (zoomLevel < 0.25) return "Regional view";
  if (zoomLevel < 0.6) return "Metro view";
  return "Provider view";
}
