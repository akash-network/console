"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Clock, Flame, TrendingUp, Users } from "lucide-react";

import type { GallerySort, GallerySource } from "@src/components/templates/communityGallery/galleryView";
import { GALLERY_SORTS, GALLERY_SOURCES } from "@src/components/templates/communityGallery/galleryView";

export const GALLERY_SOURCE_LABELS: Record<GallerySource, string> = { all: "All", official: "Official", community: "Community" };
export const GALLERY_SORT_LABELS: Record<GallerySort, string> = { popular: "Popular", trending: "Trending", newest: "Newest" };

const SOURCE_ICONS: Record<GallerySource, LucideIcon | undefined> = { all: undefined, official: BadgeCheck, community: Users };
const SORT_ICONS: Record<GallerySort, LucideIcon> = { popular: Flame, trending: TrendingUp, newest: Clock };

const COUNT_FORMAT = new Intl.NumberFormat("en-US");

export const GallerySourceFilter: FC<{ selected: GallerySource; counts: Record<GallerySource, number>; onSelect: (source: GallerySource) => void }> = ({
  selected,
  counts,
  onSelect
}) => (
  <div role="group" aria-label="Show templates from" className={SEGMENTS_CLASSES}>
    {GALLERY_SOURCES.map(source => (
      <Segment
        key={source}
        label={GALLERY_SOURCE_LABELS[source]}
        icon={SOURCE_ICONS[source]}
        isSelected={source === selected}
        onSelect={() => onSelect(source)}
      >
        <span className="font-mono text-[11px] text-muted-foreground">{COUNT_FORMAT.format(counts[source])}</span>
      </Segment>
    ))}
  </div>
);

export const GallerySortControl: FC<{ selected: GallerySort; onSelect: (sort: GallerySort) => void }> = ({ selected, onSelect }) => (
  <div role="group" aria-label="Sort by" className={SEGMENTS_CLASSES}>
    {GALLERY_SORTS.map(sort => (
      <Segment key={sort} label={GALLERY_SORT_LABELS[sort]} icon={SORT_ICONS[sort]} isSelected={sort === selected} onSelect={() => onSelect(sort)} />
    ))}
  </div>
);

const SEGMENTS_CLASSES = "inline-flex max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-[10px] border border-border bg-muted/60 p-0.5";

const Segment: FC<{ label: string; icon: LucideIcon | undefined; isSelected: boolean; onSelect: () => void; children?: React.ReactNode }> = ({
  label,
  icon: Icon,
  isSelected,
  onSelect,
  children
}) => (
  <button
    type="button"
    aria-pressed={isSelected}
    onClick={onSelect}
    className={cn(
      "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isSelected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    {label}
    {children}
  </button>
);
