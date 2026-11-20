"use client";
import type { ChangeEvent, FC } from "react";
import { useId, useMemo, useState } from "react";
import { Button, buttonVariants, Input, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Spinner } from "@akashnetwork/ui/components";
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import {
  GALLERY_SORT_LABELS,
  GALLERY_SOURCE_LABELS,
  GallerySortControl,
  GallerySourceFilter
} from "@src/components/templates/communityGallery/GalleryControls/GalleryControls";
import { GalleryEntryList } from "@src/components/templates/communityGallery/GalleryEntryList/GalleryEntryList";
import { TrendingTemplatesRow } from "@src/components/templates/communityGallery/TrendingTemplatesRow/TrendingTemplatesRow";
import type { CommunityGallery } from "@src/components/templates/communityGallery/useCommunityGallery";
import { useCommunityGallery } from "@src/components/templates/communityGallery/useCommunityGallery";
import type { TemplateSection } from "@src/components/templates/templateGalleryModel";
import { findSelectedCategory, isPopularTemplate, listUseCaseFilters, selectTemplateSections } from "@src/components/templates/templateGalleryModel";
import { useFlag } from "@src/hooks/useFlag";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { domainName, UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { OrganizationTemplatesSection } from "./OrganizationTemplatesSection/OrganizationTemplatesSection";
import { TemplateCard } from "./TemplateCard/TemplateCard";
import { TemplateUseCaseNav } from "./TemplateUseCaseNav/TemplateUseCaseNav";
import { useTemplateGalleryUrlState } from "./useTemplateGalleryUrlState/useTemplateGalleryUrlState";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export const DEPENDENCIES = {
  useFlag,
  useTemplateGalleryUrlState,
  useTemplates,
  useCommunityGallery,
  Layout,
  CustomNextSeo,
  OrganizationTemplatesSection,
  TemplateCard,
  TemplateUseCaseNav,
  GalleryEntryList,
  TrendingTemplatesRow
};

export const TemplateGallery: FC<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const isMarketplaceEnabled = d.useFlag("template_marketplace");
  const urlState = d.useTemplateGalleryUrlState();
  const { isLoading, categories } = d.useTemplates();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const communityGallery = d.useCommunityGallery({ isEnabled: !!isMarketplaceEnabled, categories, view: urlState });

  const search = urlState.search;
  const selectedCategory = communityGallery ? communityGallery.selectedCategory : findSelectedCategory(categories, urlState.category);
  const awesomeAkashFilters = useMemo(() => listUseCaseFilters(categories), [categories]);
  const filters = communityGallery ? communityGallery.filters : awesomeAkashFilters;
  const selectedFilter = filters.find(filter => filter.category === selectedCategory) ?? filters[0];
  const sections = useMemo(() => selectTemplateSections({ categories, category: selectedCategory, search }), [categories, selectedCategory, search]);
  const trimmedSearch = search.trim();
  const hasNoMatch = !communityGallery && categories.length > 0 && sections.length === 0 && !!trimmedSearch;

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => urlState.changeSearch(event.target.value);

  const selectCategory = (category: string | null) => {
    setIsFilterSheetOpen(false);
    urlState.selectCategory(category);
  };

  return (
    <d.Layout background="dots" isLoading={isLoading} disableContainer containerClassName="flex h-full flex-col">
      <d.CustomNextSeo
        title="Template Gallery"
        url={`${domainName}${UrlService.templates()}`}
        description="Explore all the templates made by the community to easily deploy any docker container on the Akash Network."
      />

      <div className="flex w-full flex-col md:h-page-viewport">
        <div className="flex min-h-[60px] shrink-0 items-center gap-4 border-b border-border bg-background px-4 py-2.5 sm:px-6">
          <h1 className="mr-auto text-xl font-bold tracking-tight">Templates</h1>
          {isMarketplaceEnabled && (
            <Link href={UrlService.myTemplates()} className={buttonVariants({ variant: "outline", size: "sm" })}>
              My templates
            </Link>
          )}
        </div>

        <div className="flex md:min-h-0 md:flex-1">
          <nav
            aria-label="Filter by use case"
            className="hidden w-[232px] shrink-0 overflow-y-auto border-r border-border bg-background px-4 pb-8 pt-5 md:block"
          >
            <p className={`${OVERLINE_CLASSES} px-2 pb-2.5`}>Filter by use case</p>
            <d.TemplateUseCaseNav filters={filters} selectedCategory={selectedCategory} onSelect={selectCategory} />
          </nav>

          <div className="min-w-0 flex-1 md:overflow-y-auto">
            <div className="container flex flex-col gap-6 px-4 pb-8 pt-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {communityGallery && <GallerySourceFilter selected={urlState.source} counts={communityGallery.sourceCounts} onSelect={urlState.selectSource} />}
                <Input
                  value={search}
                  onChange={changeSearch}
                  aria-label="Search templates"
                  placeholder={communityGallery ? "Search templates or publishers" : "Search templates"}
                  type="text"
                  className="w-full sm:max-w-[380px]"
                  startIcon={<Search className="ml-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  endIcon={
                    !!search && (
                      <Button size="icon" variant="text" aria-label="Clear search" onClick={urlState.clearSearch}>
                        <X className="h-4 w-4" />
                      </Button>
                    )
                  }
                />

                {filters.length > 1 && (
                  <Button variant="outline" className="w-full justify-between gap-2 md:hidden" onClick={() => setIsFilterSheetOpen(true)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="sr-only">Filter by use case: </span>
                      <span className="truncate">{selectedFilter.label}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{selectedFilter.count}</span>
                  </Button>
                )}

                {communityGallery && (
                  <div className="flex items-center gap-2.5 sm:ml-auto">
                    <span className="text-[13px] text-muted-foreground">Sort</span>
                    <GallerySortControl selected={urlState.sort} onSelect={urlState.selectSort} />
                  </div>
                )}
              </div>

              {communityGallery && <d.TrendingTemplatesRow entries={communityGallery.trendingEntries} />}

              <d.OrganizationTemplatesSection />

              {isLoading && categories.length === 0 && (
                <div className="flex justify-center py-12">
                  <Spinner size="large" />
                </div>
              )}

              {communityGallery ? (
                <CommunityGalleryView gallery={communityGallery} view={urlState} dependencies={d} />
              ) : (
                sections.map(section => <TemplateSectionView key={section.title} section={section} dependencies={d} />)
              )}

              {hasNoMatch && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
                  <Search className="h-[22px] w-[22px] text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-semibold">No templates match “{trimmedSearch}”</p>
                  <p className="text-[12.5px] text-muted-foreground">Try a different search, or another use case.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto px-4 pb-6 pt-5">
          <SheetHeader className="pb-2 text-left">
            <SheetTitle>Filter by use case</SheetTitle>
            <SheetDescription className="sr-only">Show the templates for one use case.</SheetDescription>
          </SheetHeader>
          <d.TemplateUseCaseNav filters={filters} selectedCategory={selectedCategory} onSelect={selectCategory} />
        </SheetContent>
      </Sheet>
    </d.Layout>
  );
};

const CommunityGalleryView: FC<{
  gallery: CommunityGallery;
  view: Pick<ReturnType<typeof useTemplateGalleryUrlState>, "source" | "sort" | "search">;
  dependencies: typeof DEPENDENCIES;
}> = ({ gallery, view, dependencies: d }) => {
  if (gallery.isLoadingCommunity) {
    return (
      <div role="status" aria-label="Loading community templates" className="flex justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <>
      {gallery.hasCommunityFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
          <span className="mr-auto">Couldn&apos;t load community templates. Official templates are listed without their usage numbers.</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={gallery.retryCommunity}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}
      <d.GalleryEntryList
        key={`${view.source}|${view.sort}|${gallery.selectedCategory ?? ""}|${view.search}`}
        title={`${GALLERY_SOURCE_LABELS[view.source]} templates · ${GALLERY_SORT_LABELS[view.sort]}`}
        entries={gallery.shownEntries}
        search={view.search}
        showsCommunityNote={view.source !== "official"}
      />
    </>
  );
};

const TemplateSectionView: FC<{ section: TemplateSection; dependencies: typeof DEPENDENCIES }> = ({ section, dependencies: d }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={`${OVERLINE_CLASSES} pb-3 pt-2`}>
        {section.title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1400px]:grid-cols-3">
        {section.templates.map(template => (
          <d.TemplateCard key={template.id} template={template} isPopular={isPopularTemplate(template)} />
        ))}
      </div>
    </section>
  );
};
