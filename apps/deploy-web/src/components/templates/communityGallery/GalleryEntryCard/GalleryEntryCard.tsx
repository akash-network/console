"use client";
import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, GitFork, History, Rocket, ShieldAlert } from "lucide-react";
import Link from "next/link";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import { PublisherName } from "@src/components/templates/communityGallery/PublisherName/PublisherName";
import { formatCount, formatStillUp } from "@src/components/templates/communityGallery/usageNumbers";
import { HardwareProfile } from "@src/components/templates/TemplateCard/TemplateCard";
import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import { UrlService } from "@src/utils/urlUtils";

export const COMMUNITY_CARD_NOTE = "Community · not reviewed by Akash";

export const AWESOME_AKASH_PUBLISHER = { name: "Akash Network", verified: true };

export function galleryEntryHref(entry: Pick<GalleryEntry, "origin" | "id">): string {
  return entry.origin === "console" ? UrlService.template(entry.id) : UrlService.templateDetails(entry.id);
}

export const GalleryEntryCard: FC<{ entry: GalleryEntry }> = ({ entry }) => {
  const publisher = entry.publisher ?? AWESOME_AKASH_PUBLISHER;

  return (
    <Link
      href={galleryEntryHref(entry)}
      prefetch={false}
      className="group flex flex-col rounded-[14px] border border-border bg-card px-[18px] pb-3.5 pt-4 text-card-foreground !no-underline shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-600/45 hover:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.12),0_0_0_1px_rgba(37,99,235,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <TemplateIcon icon={entry.icon} className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">{entry.title}</h3>
        {entry.isOfficial ? <OfficialBadge /> : entry.scores.isTrending && <TrendingBadge />}
      </div>

      <p className="mt-2.5 line-clamp-2 min-h-[34px] break-words text-[12.5px] leading-[17px] text-muted-foreground">{entry.summary}</p>

      <p className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-[18px] text-muted-foreground">
        <PublisherName name={publisher.name} verified={publisher.verified} />
        {entry.origin === "awesome-akash" && <span>· awesome-akash</span>}
        {entry.usage.stillUpAfter24h !== null && <span>· {formatStillUp(entry.usage.stillUpAfter24h)}</span>}
      </p>

      {!entry.isOfficial && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium leading-4 text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {COMMUNITY_CARD_NOTE}
        </p>
      )}

      <div className="min-h-3.5 flex-1" />
      <div className="-mx-[18px] h-px bg-border" />
      <div className="mt-3 flex min-h-[18px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {entry.resources && <HardwareProfile hardware={entry.resources} />}
        <ul aria-label="Usage" className="ml-auto flex items-center gap-x-3.5">
          {entry.versionCount !== null && <UsageStat icon={History} label="Versions" value={entry.versionCount} />}
          {entry.usage.forks > 0 && <UsageStat icon={GitFork} label="Forks" value={entry.usage.forks} />}
          {entry.usage.deploys > 0 && <UsageStat icon={Rocket} label="Deploys" value={entry.usage.deploys} />}
        </ul>
      </div>
    </Link>
  );
};

const UsageStat: FC<{ icon: LucideIcon; label: string; value: number }> = ({ icon: Icon, label, value }) => (
  <li title={label} className="inline-flex items-center gap-1.5">
    <Icon className="h-[15px] w-[15px] shrink-0 opacity-50" aria-hidden="true" />
    <span className="sr-only">{label}: </span>
    <span className="whitespace-nowrap font-mono text-[12.5px] text-foreground/65">{formatCount(value)}</span>
  </li>
);

export const OfficialBadge: FC = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-600/25 bg-blue-600/10 px-2 py-0.5 font-mono text-[11.5px] font-medium text-blue-600 dark:text-blue-400">
    <BadgeCheck className="h-3 w-3" aria-hidden="true" />
    Official
  </span>
);

const TrendingBadge: FC = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-600/25 bg-orange-600/10 px-2 py-0.5 font-mono text-[11.5px] font-medium text-orange-700 dark:text-orange-400">
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    Trending
  </span>
);
