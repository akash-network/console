"use client";
import type { ChangeEventHandler } from "react";
import { useEffect, useState } from "react";
import { MdSearchOff } from "react-icons/md";
import { Button, buttonVariants, Input, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { FilterList, Xmark } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";

import { LinkTo } from "@src/components/shared/LinkTo";
import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { domainName, UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { Title } from "../shared/Title";
import type { Props as MobileTemplatesFilterProps } from "./MobileTemplatesFilter";
import { MobileTemplatesFilter } from "./MobileTemplatesFilter";
import { TemplateBox } from "./TemplateBox";

let timeoutId: NodeJS.Timeout | null = null;

const isRecommended = (t: TemplateOutputSummaryWithCategory) => t.tags?.includes("recommended") ?? false;
const isPopular = (t: TemplateOutputSummaryWithCategory) => t.tags?.includes("popular") ?? false;

const FEATURED_TEMPLATE_IDS = ["akash-network-awesome-akash-openclaw"];

export const DEPENDENCIES = {
  useRouter,
  useSearchParams,
  useTemplates,
  Layout,
  CustomNextSeo,
  MobileTemplatesFilter,
  TemplateBox
};

export const TemplateGallery: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState("");
  const [shownTemplates, setShownTemplates] = useState<TemplateOutputSummaryWithCategory[]>([]);
  const { isLoading: isLoadingTemplates, categories, templates } = d.useTemplates();
  const router = d.useRouter();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchParams = d.useSearchParams();

  useEffect(() => {
    const queryCategory = searchParams?.get("category") as string;
    const querySearch = searchParams?.get("search") as string;

    if (queryCategory) {
      setSelectedCategoryTitle(queryCategory);
    }

    if (querySearch) {
      setSearchTerms(querySearch);
    }
  }, []);

  useEffect(() => {
    const queryCategory = searchParams?.get("category");
    const querySearch = searchParams?.get("search");
    let _templates: TemplateOutputSummaryWithCategory[] = [];

    if (queryCategory) {
      const selectedCategory = categories.find(x => x.title === queryCategory);
      _templates = [...(selectedCategory?.templates || [])];
    } else {
      _templates = [...templates];
    }

    _templates.sort((a, b) => {
      const aFeatured = FEATURED_TEMPLATE_IDS.indexOf(a.id) !== -1 ? FEATURED_TEMPLATE_IDS.indexOf(a.id) : Infinity;
      const bFeatured = FEATURED_TEMPLATE_IDS.indexOf(b.id) !== -1 ? FEATURED_TEMPLATE_IDS.indexOf(b.id) : Infinity;
      if (aFeatured !== bFeatured) return aFeatured - bFeatured;

      const aTag = isRecommended(a) ? 0 : isPopular(a) ? 1 : 2;
      const bTag = isRecommended(b) ? 0 : isPopular(b) ? 1 : 2;
      return aTag - bTag;
    });

    if (querySearch) {
      // TODO: use minisearch instead https://lucaong.github.io/minisearch/
      const searchTermsSplit = querySearch?.split(" ").map(x => x.toLowerCase());
      _templates = _templates.filter(x => searchTermsSplit.some(s => x.name?.toLowerCase().includes(s) || x.summary?.toLowerCase().includes(s)));
    }

    setShownTemplates(_templates);

    return () => {
      clearTimeout(timeoutId as NodeJS.Timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

  const onSearchChange: ChangeEventHandler<HTMLInputElement> = event => {
    const searchValue = event.target.value;
    setSearchTerms(searchValue);

    if (searchValue) {
      clearTimeout(timeoutId as NodeJS.Timeout);
      timeoutId = setTimeout(() => {
        router.replace(UrlService.templates(selectedCategoryTitle || "", searchValue));
      }, 300);
    } else {
      router.replace(UrlService.templates(selectedCategoryTitle || "", ""));
    }
  };

  const onCategoryClick: MobileTemplatesFilterProps["onCategoryClick"] = categoryTitle => {
    setSelectedCategoryTitle(categoryTitle);

    if (isMobileSearchOpen) {
      setIsMobileSearchOpen(false);
    }
    router.replace(UrlService.templates(categoryTitle, searchTerms));
  };

  const onClearSearch = () => {
    setSearchTerms("");

    router.replace(UrlService.templates(selectedCategoryTitle || "", ""));
  };

  const searchBar = (
    <Input
      value={searchTerms}
      onChange={onSearchChange}
      label="Search"
      className="w-full"
      type="text"
      endIcon={
        !!searchTerms && (
          <Button size="icon" variant="text" onClick={onClearSearch}>
            <Xmark className="text-xs" />
          </Button>
        )
      }
    />
  );

  return (
    <d.Layout isLoading={isLoadingTemplates}>
      <d.CustomNextSeo
        title="Template Gallery"
        url={`${domainName}${UrlService.templates()}`}
        description="Explore all the templates made by the community to easily deploy any docker container on the Akash Network."
      />

      <div className="mb-6">
        <Title className="mb-2">Deploy an App</Title>

        <Title subTitle className="text-base font-normal text-muted-foreground sm:text-lg">
          Jumpstart your app development process with our pre-built solutions.
        </Title>
      </div>

      <div className="mb-8">
        <div className="hidden md:block">{searchBar}</div>
      </div>

      <div className="mb-8 block md:hidden">
        {searchBar}

        <Button onClick={() => setIsMobileSearchOpen(true)} className="mt-2 flex w-full items-center" variant="outline">
          Filter by category
          <FilterList className="ml-2 text-xs" />
        </Button>
        <d.MobileTemplatesFilter
          handleDrawerToggle={() => setIsMobileSearchOpen(prev => !prev)}
          isOpen={isMobileSearchOpen}
          templates={templates}
          categories={categories}
          onCategoryClick={onCategoryClick}
          selectedCategoryTitle={selectedCategoryTitle}
        />

        {selectedCategoryTitle && !searchTerms && <p className="mt-4 font-bold">{selectedCategoryTitle}</p>}
      </div>

      <div className="flex">
        {templates.length > 0 && (
          <div className="mr-12 hidden w-[222px] md:block">
            <p className="mb-4 font-bold">Filter by category</p>

            <ul className="flex flex-col items-start">
              {templates && (
                <li
                  className={cn(
                    { ["bg-muted-foreground/10"]: !selectedCategoryTitle },
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-full justify-start px-4 py-0"
                  )}
                  onClick={() => onCategoryClick(null)}
                >
                  All{" "}
                  <span className="text-xs">
                    <small className="ml-2 text-muted-foreground">({templates.length - 1})</small>
                  </span>
                </li>
              )}

              {categories.map(category => (
                <li
                  key={category.title}
                  className={cn(
                    { ["bg-muted-foreground/10"]: category.title === selectedCategoryTitle },
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-full justify-start px-4 py-0"
                  )}
                  onClick={() => onCategoryClick(category.title)}
                >
                  {category.title}{" "}
                  <span className="text-xs">
                    <small className="ml-2 text-muted-foreground">({category.templates.length})</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1">
          {searchTerms && (
            <div className="flex items-center pb-6">
              <p className="text-muted-foreground">
                Searching for: "{searchTerms}" - {shownTemplates.length} results
              </p>

              <div className="ml-4 inline-flex">
                <LinkTo onClick={onClearSearch}>Clear</LinkTo>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {shownTemplates.map((template, id) => (
              <d.TemplateBox key={`${template.id}_${id}`} template={template} isRecommended={isRecommended(template)} isPopular={isPopular(template)} />
            ))}
          </div>

          {isLoadingTemplates && (
            <div className="mt-8 flex items-center justify-center">
              <Spinner size="large" />
            </div>
          )}

          {!isLoadingTemplates && categories.length > 0 && shownTemplates.length === 0 && (!!searchTerms || !!selectedCategoryTitle) && (
            <div className="flex h-[200px] flex-col items-center justify-center border border-muted-foreground">
              <MdSearchOff className="mb-4 text-6xl" />
              <p>No search result found. Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </div>
    </d.Layout>
  );
};
