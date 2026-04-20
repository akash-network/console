"use client";
import type { FC, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";
import { MdSpeed } from "react-icons/md";
import { Checkbox, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { InfoCircle, NavArrowDown, NavArrowUp } from "iconoir-react";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { GpuPricesResponse } from "@src/types/gpu";
import { CollapsibleCard } from "./CollapsibleCard";

type NetworkGpuModel = {
  vendor: string;
  model: string;
  available: number;
  total: number;
};

const NvidiaLogo: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.948 8.798v-.472c.068-.005.137-.009.209-.009 2.976-.154 5.261 2.382 5.261 2.382s-2.596 2.932-5.083 2.932a4.09 4.09 0 0 1-.387-.018V10.1c1.296.152 1.558.874 2.369 2.121l1.756-1.479s-1.48-1.979-3.493-1.979a6.31 6.31 0 0 0-.632.035Zm0-2.834v1.69l.209-.021c3.992-.253 7.038 3.113 7.038 3.113s-3.474 3.794-6.828 3.794a6.44 6.44 0 0 1-.419-.014v1.02c.122.004.243.01.368.01 3.06 0 5.268-1.537 7.403-3.391.352.281 1.789 1.079 2.086 1.397-2.032 1.584-6.761 3.252-9.44 3.252-.142 0-.279-.006-.417-.016v1.14H22V5.964H8.948ZM8.948 15.63v-.975a6.683 6.683 0 0 1-.522-.038C5.59 14.262 3.86 11.62 3.86 11.62s2.318-2.702 4.93-3.032v-.534C5.488 8.469 2.185 11.469 2.185 11.469s1.877 4.756 6.763 4.161ZM2 5.964V18.25h5.948v-1.356c-3.636.214-5.396-3.166-5.396-3.166s1.742-2.604 4.396-3.349V8.236C4.51 8.758 2.862 10.496 2.862 10.496s-.996-1.684-.527-3.2L2 5.964Z" />
  </svg>
);

const AmdLogo: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="m18.324 9.137 2.538 2.54V9.137Zm2.56 7.737h-1.21l-2.476-2.475v2.475h-.96v-3.983h1.222l2.464 2.463v-2.463h.96Zm-6.167 0h1.67c.995 0 1.724-.673 1.724-1.63v-.71c0-.958-.729-1.643-1.724-1.643h-1.67Zm.96-3.137h.614c.55 0 .85.34.85.827v.506c0 .487-.3.958-.85.958h-.614ZM12.09 16.874l-.235-.74h-1.8l-.234.74H8.77l1.66-3.983h1.258l1.66 3.983Zm-1.124-3.21-.644 1.72h1.289ZM2 20l4.012-4.012v-3.97h1.01v3.377l5.13-5.13H8.764v-1.01h4.49L18.387 4H4.013v14.372L2 20Zm18.324-13.675L22 4.647V4h-.647Z" />
  </svg>
);

const ChipPill: FC<{ selected: boolean; onClick: () => void; children: ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
      selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
    )}
  >
    {children}
  </button>
);

type Props = {
  services: ServiceType[];
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  gpuPrices: GpuPricesResponse | undefined;
};

export const GpuCard: FC<Props> = ({ services, setValue, gpuPrices }) => {
  // GPU is an app-level filter: all services share the same hasGpu / model / vendor / count.
  // We read "current" state from services[0] and fan out writes to every service.
  const reference = services[0]?.profile;
  const hasGpu = reference?.hasGpu ?? false;
  const selectedVendor = reference?.gpuModels?.[0]?.vendor ?? "nvidia";
  const selectedModel = reference?.gpuModels?.[0]?.name ?? "";
  const gpuCount = reference?.gpu || 1;

  const [gpuVendorFilter, setGpuVendorFilter] = useState<string | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { networkModels, popularModels, vendors } = useMemo(() => {
    if (!gpuPrices?.models.length) {
      return { networkModels: [] as NetworkGpuModel[], popularModels: [] as NetworkGpuModel[], vendors: [] as string[] };
    }

    const modelMap = new Map<string, NetworkGpuModel>();
    const vendorSet = new Set<string>();

    for (const m of gpuPrices.models) {
      vendorSet.add(m.vendor);
      const key = `${m.vendor}:${m.model}`;
      const existing = modelMap.get(key);
      if (existing) {
        existing.available += m.availability.available;
        existing.total += m.availability.total;
      } else {
        modelMap.set(key, {
          vendor: m.vendor,
          model: m.model,
          available: m.availability.available,
          total: m.availability.total
        });
      }
    }

    const all = Array.from(modelMap.values()).sort((a, b) => b.available - a.available);
    const popular = all.filter(m => m.total > 0).slice(0, 5);

    return { networkModels: all, popularModels: popular, vendors: Array.from(vendorSet).sort() };
  }, [gpuPrices]);

  const setHasGpuAll = useCallback(
    (checked: boolean) => {
      services.forEach((s, i) => {
        setValue(`services.${i}.profile.hasGpu`, checked);
        if (checked) {
          if (!s.profile.gpuModels?.length) {
            setValue(`services.${i}.profile.gpuModels`, [{ vendor: "nvidia", name: "", memory: "", interface: "" }]);
          }
          if (!s.profile.gpu) {
            setValue(`services.${i}.profile.gpu`, 1);
          }
        }
      });
    },
    [services, setValue]
  );

  const setGpuModelAll = useCallback(
    (vendor: string, name: string) => {
      services.forEach((_, i) => {
        setValue(`services.${i}.profile.gpuModels`, [{ vendor, name, memory: "", interface: "" }]);
      });
    },
    [services, setValue]
  );

  const setGpuCountAll = useCallback(
    (count: number) => {
      services.forEach((_, i) => {
        setValue(`services.${i}.profile.gpu`, count);
      });
    },
    [services, setValue]
  );

  const summary = hasGpu ? `${gpuCount}× ${selectedModel ? selectedModel.toUpperCase() : "Any"}` : "Off";

  return (
    <CollapsibleCard
      icon={<MdSpeed className="h-3.5 w-3.5" />}
      title="GPU"
      summary={summary}
      expanded={expanded}
      onExpandedChange={setExpanded}
      hasChanges={hasGpu}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={hasGpu}
            onCheckedChange={checked => {
              const next = Boolean(checked);
              setHasGpuAll(next);
              if (next) setExpanded(true);
            }}
          />
          <label className="text-xs text-muted-foreground">Require GPU</label>
          <CustomTooltip
            title={
              <>
                The amount of GPUs required for this workload. You can specify vendor and model. If you don&apos;t specify any model, providers with any GPU
                model will bid.
              </>
            }
          >
            <InfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </CustomTooltip>
        </div>

        {hasGpu && (
          <>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Vendor</label>
              <div className="flex flex-wrap gap-2">
                <ChipPill selected={gpuVendorFilter === null} onClick={() => setGpuVendorFilter(null)}>
                  All
                </ChipPill>
                {vendors.map(v => (
                  <ChipPill key={v} selected={gpuVendorFilter === v} onClick={() => setGpuVendorFilter(gpuVendorFilter === v ? null : v)}>
                    <span className="flex items-center gap-1.5">
                      {v === "nvidia" && <NvidiaLogo className="h-3.5 w-3.5" />}
                      {v === "amd" && <AmdLogo className="h-3.5 w-3.5" />}
                      <span className="capitalize">{v}</span>
                    </span>
                  </ChipPill>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Model</label>
              <div className="flex flex-wrap gap-2">
                <ChipPill
                  selected={!selectedModel}
                  onClick={() => {
                    setGpuModelAll("nvidia", "");
                    setGpuVendorFilter(null);
                  }}
                >
                  Any
                </ChipPill>
                {popularModels
                  .filter(m => !gpuVendorFilter || m.vendor === gpuVendorFilter)
                  .map(m => (
                    <ChipPill
                      key={`${m.vendor}:${m.model}`}
                      selected={selectedModel === m.model && selectedVendor === m.vendor}
                      onClick={() => setGpuModelAll(m.vendor, m.model)}
                    >
                      <span className="flex items-center gap-1">
                        {m.vendor === "nvidia" && <NvidiaLogo className="h-3 w-3" />}
                        {m.vendor === "amd" && <AmdLogo className="h-3 w-3" />}
                        <span className="uppercase">{m.model}</span>
                        <span className={cn("ml-0.5 text-[10px]", m.available > 0 ? "text-green-500" : "text-muted-foreground/50")}>{m.available}</span>
                      </span>
                    </ChipPill>
                  ))}
              </div>
            </div>

            {networkModels.length > popularModels.length && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAllModels(v => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAllModels ? "Hide" : "More models"}
                  {showAllModels ? <NavArrowUp className="h-3 w-3" /> : <NavArrowDown className="h-3 w-3" />}
                </button>
                {showAllModels && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {networkModels
                      .filter(m => !gpuVendorFilter || m.vendor === gpuVendorFilter)
                      .filter(m => !popularModels.some(p => p.vendor === m.vendor && p.model === m.model))
                      .map(m => (
                        <button
                          key={`${m.vendor}:${m.model}`}
                          type="button"
                          onClick={() => setGpuModelAll(m.vendor, m.model)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                            selectedModel === m.model && selectedVendor === m.vendor
                              ? "border-primary bg-primary/10 text-primary"
                              : m.available > 0
                                ? "border-border bg-card text-muted-foreground hover:text-foreground"
                                : "border-border/50 bg-card text-muted-foreground/40 hover:text-muted-foreground"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <span className="uppercase">{m.model}</span>
                            <span className={cn("text-[9px]", m.available > 0 ? "text-green-500" : "text-muted-foreground/40")}>{m.available}</span>
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Count</label>
              <div className="flex items-center rounded-lg border border-border">
                <button
                  type="button"
                  className="px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setGpuCountAll(Math.max(1, gpuCount - 1))}
                >
                  −
                </button>
                <span className="min-w-[28px] border-x border-border px-2 py-1 text-center font-mono text-sm">{gpuCount}</span>
                <button
                  type="button"
                  className="px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setGpuCountAll(Math.min(8, gpuCount + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
};
