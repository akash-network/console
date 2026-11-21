"use client";
import type { FC } from "react";
import { useId } from "react";
import Link from "next/link";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import { galleryEntryHref } from "@src/components/templates/communityGallery/GalleryEntryCard/GalleryEntryCard";
import { pluralize } from "@src/components/templates/communityGallery/usageNumbers";
import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export const TrendingTemplatesRow: FC<{ entries: GalleryEntry[] }> = ({ entries }) => {
  const headingId = useId();

  if (entries.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3 pt-2">
        <h2 id={headingId} className={OVERLINE_CLASSES}>
          Trending this week
        </h2>
        <p className="text-[12.5px] text-muted-foreground">Deployments still running after 24 h, this week against last week</p>
      </div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1400px]:grid-cols-4">
        {entries.map((entry, index) => (
          <li key={entry.key}>
            <Link
              href={galleryEntryHref(entry)}
              prefetch={false}
              className="flex h-full items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3 text-card-foreground !no-underline shadow-sm transition-colors hover:border-blue-600/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className="font-mono text-lg font-medium text-muted-foreground/60">
                {index + 1}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                <TemplateIcon icon={entry.icon} className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{entry.title}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{describeTrendingEntry(entry)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
};

function describeTrendingEntry(entry: GalleryEntry): string {
  const publishedBy = entry.isOfficial ? "Official" : entry.publisher?.name;
  const deploys = entry.usage.deploys > 0 ? pluralize(entry.usage.deploys, "deploy") : undefined;

  return [publishedBy, deploys].filter(part => !!part).join(" · ");
}
