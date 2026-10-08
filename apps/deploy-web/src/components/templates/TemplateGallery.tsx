"use client";
import type { ChangeEvent, FC } from "react";
import { useId, useMemo, useState } from "react";
import { Button, Input, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Spinner } from "@akashnetwork/ui/components";
import { Search, SlidersHorizontal, X } from "lucide-react";

import type { TemplateSection } from "@src/components/templates/templateGalleryModel";
import { findSelectedCategory, isPopularTemplate, listUseCaseFilters, selectTemplateSections } from "@src/components/templates/templateGalleryModel";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { domainName, UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { TemplateCard } from "./TemplateCard/TemplateCard";
import { TemplateUseCaseNav } from "./TemplateUseCaseNav/TemplateUseCaseNav";
import { useTemplateGalleryUrlState } from "./useTemplateGalleryUrlState/useTemplateGalleryUrlState";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export const DEPENDENCIES = {
  useTemplateGalleryUrlState,
  useTemplates,
  Layout,
  CustomNextSeo,
  TemplateCard,
  TemplateUseCaseNav
};

export const TemplateGallery: FC<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const urlState = d.useTemplateGalleryUrlState();
  const { isLoading, categories } = d.useTemplates();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const search = urlState.search;
  const selectedCategory = findSelectedCategory(categories, urlState.category);
  const filters = useMemo(() => listUseCaseFilters(categories), [categories]);
  const selectedFilter = filters.find(filter => filter.category === selectedCategory) ?? filters[0];
  const sections = useMemo(() => selectTemplateSections({ categories, category: selectedCategory, search }), [categories, selectedCategory, search]);
  const trimmedSearch = search.trim();
  const hasNoMatch = categories.length > 0 && sections.length === 0 && !!trimmedSearch;

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
          <h1 className="text-xl font-bold tracking-tight">Templates</h1>
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
            <div className="flex flex-col gap-6 px-4 pb-8 pt-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={changeSearch}
                  aria-label="Search templates"
                  placeholder="Search templates"
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
              </div>

              {isLoading && categories.length === 0 && (
                <div className="flex justify-center py-12">
                  <Spinner size="large" />
                </div>
              )}

              {sections.map(section => (
                <TemplateSectionView key={section.title} section={section} dependencies={d} />
              ))}

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
