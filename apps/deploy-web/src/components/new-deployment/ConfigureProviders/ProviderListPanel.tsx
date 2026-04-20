"use client";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Check, Search, Xmark } from "iconoir-react";

import type { ActiveFilter } from "@src/hooks/useActiveFilters";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { ActiveFilterBadges } from "./ActiveFilterBadges";
import type { EnrichedProvider } from "./ProviderTable";
import { ProviderTable } from "./ProviderTable";

const REGION_COUNTRY_MAP: Record<string, string[]> = {
  "north-america": ["US", "CA", "MX"],
  europe: ["DE", "FR", "GB", "NL", "IE", "SE", "NO", "FI", "DK", "CH", "AT", "BE", "PL", "CZ", "PT", "ES", "IT"],
  apac: ["JP", "SG", "AU", "HK", "KR", "IN", "TW", "NZ"]
};

type SortOption = "leaseCount" | "uptime7d" | "availableCpu" | "availableMemory" | "name";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "leaseCount", label: "Active Leases" },
  { value: "uptime7d", label: "Uptime" },
  { value: "availableCpu", label: "CPU available" },
  { value: "availableMemory", label: "Memory available" },
  { value: "name", label: "Name" }
];

const CheckboxPill: FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={cn(
      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
      checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
    )}
  >
    {checked && <Check className="h-3 w-3" />}
    {label}
  </button>
);

type Props = {
  providers: EnrichedProvider[];
  total: number;
  isLoading: boolean;
  placementFilters: PlacementFilters;
  activeFilters: ActiveFilter[];
  onDismissFilter: (key: string) => void;
  onClearAllFilters: () => void;
  onGetQuote: (provider: EnrichedProvider) => void;
  onToggleFavorite: (owner: string) => void;
};

export const ProviderListPanel: FC<Props> = ({
  providers,
  total,
  isLoading,
  placementFilters,
  activeFilters,
  onDismissFilter,
  onClearAllFilters,
  onGetQuote,
  onToggleFavorite
}) => {
  const [search, setSearch] = useState("");
  const [showAudited, setShowAudited] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("leaseCount");

  const filtered = useMemo(() => {
    let result = providers;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => (p.name ?? "").toLowerCase().includes(q) || p.hostUri.toLowerCase().includes(q) || p.location.toLowerCase().includes(q));
    }

    if (showAudited) {
      result = result.filter(p => p.isAudited);
    }

    if (showFavorites) {
      result = result.filter(p => p.isFavorite);
    }

    if (placementFilters.regions.length > 0) {
      const allowedCountries = placementFilters.regions.flatMap(r => REGION_COUNTRY_MAP[r] ?? []);
      result = result.filter(p => allowedCountries.includes(p.countryCode));
    }

    return result;
  }, [providers, search, showAudited, showFavorites, placementFilters.regions]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search providers..."
            className="h-8 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Xmark className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-border" />

        <CheckboxPill label="Audited" checked={showAudited} onChange={setShowAudited} />
        <CheckboxPill label="Favorites" checked={showFavorites} onChange={setShowFavorites} />

        <div className="h-4 w-px bg-border" />

        <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
          <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs">
            <span className="mr-1 text-muted-foreground">Sort:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ActiveFilterBadges filters={activeFilters} onDismiss={onDismissFilter} onClearAll={onClearAllFilters} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProviderTable providers={filtered} isLoading={isLoading} total={total} sortBy={sortBy} onGetQuote={onGetQuote} onToggleFavorite={onToggleFavorite} />
      </div>
    </div>
  );
};
