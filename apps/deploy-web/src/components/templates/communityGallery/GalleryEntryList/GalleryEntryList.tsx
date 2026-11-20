"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Info, Search } from "lucide-react";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import { GALLERY_PAGE_SIZE } from "@src/components/templates/communityGallery/galleryEntries";
import { GalleryEntryCard } from "@src/components/templates/communityGallery/GalleryEntryCard/GalleryEntryCard";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export const COMMUNITY_GALLERY_NOTE = "Community templates are shared by Akash users and are not reviewed by Akash.";

export const DEPENDENCIES = { GalleryEntryCard };

export interface GalleryEntryListProps {
  title: string;
  entries: GalleryEntry[];
  search: string;
  showsCommunityNote: boolean;
  dependencies?: typeof DEPENDENCIES;
}

/** The caller remounts the list with a key when the filters or the sort change, which starts it over at the first page. */
export const GalleryEntryList: FC<GalleryEntryListProps> = ({ title, entries, search, showsCommunityNote, dependencies: d = DEPENDENCIES }) => {
  const headingId = useId();
  const [shownCount, setShownCount] = useState(GALLERY_PAGE_SIZE);
  const trimmedSearch = search.trim();

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3 pt-2">
        <h2 id={headingId} className={OVERLINE_CLASSES}>
          {title}
        </h2>
        {showsCommunityNote && (
          <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {COMMUNITY_GALLERY_NOTE}
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Search className="h-[22px] w-[22px] text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold">{trimmedSearch ? `No templates match “${trimmedSearch}”` : "No templates here yet"}</p>
          <p className="text-[12.5px] text-muted-foreground">Try a different search, another use case, or All templates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1400px]:grid-cols-3">
          {entries.slice(0, shownCount).map(entry => (
            <d.GalleryEntryCard key={entry.key} entry={entry} />
          ))}
        </div>
      )}

      {entries.length > shownCount && (
        <div className="flex justify-center pt-6">
          <Button variant="outline" onClick={() => setShownCount(count => count + GALLERY_PAGE_SIZE)}>
            Show more templates
          </Button>
        </div>
      )}
    </section>
  );
};
