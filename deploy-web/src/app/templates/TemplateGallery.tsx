"use client";
import { useState, useEffect } from "react";
import { useTemplates } from "../../context/TemplatesProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { PageContainer } from "@src/components/shared/PageContainer";
import { TemplateBox } from "@src/app/templates/TemplateBox";
import { LinkTo } from "@src/components/shared/LinkTo";
import { MobileTemplatesFilter } from "@src/app/templates/MobileTemplatesFilter";
import { ApiTemplate } from "@src/types";
import { Button, buttonVariants } from "@src/components/ui/button";
import { FilterList, Xmark } from "iconoir-react";
import { MdSearchOff } from "react-icons/md";
import Spinner from "@src/components/shared/Spinner";
import { cn } from "@src/utils/styleUtils";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";

type Props = {};

// const useStyles = makeStyles()(theme => ({
//   gallery: {
//     display: "flex"
//   },
//   title: {
//     fontSize: "1.5rem",
//     fontWeight: "bold"
//   },
//   categoryList: {
//     overflow: "auto",
//     flexBasis: "280px"
//   },
//   templateList: {
//     overflow: "auto",
//     flexBasis: 0,
//     flexGrow: 999,
//     "& .MuiAvatar-img": {
//       objectFit: "contain"
//     }
//   }
// }));

let timeoutId: NodeJS.Timeout | null = null;

export const TemplateGallery: React.FunctionComponent<Props> = ({}) => {
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState("");
  const [shownTemplates, setShownTemplates] = useState<ApiTemplate[]>([]);
  const { isLoading: isLoadingTemplates, categories, templates } = useTemplates();
  const router = useRouter();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchParams = useSearchParams();

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
    const queryCategory = searchParams?.get("category") as string;
    const querySearch = searchParams?.get("search") as string;
    let _templates: ApiTemplate[] = [];

    if (queryCategory) {
      const selectedCategory = categories.find(x => x.title === queryCategory);
      _templates = selectedCategory?.templates || [];
    } else {
      _templates = templates;
    }

    if (querySearch) {
      const searchTermsSplit = querySearch?.split(" ").map(x => x.toLowerCase());
      _templates = templates.filter(x => searchTermsSplit.some(s => x.name?.toLowerCase().includes(s) || x.readme?.toLowerCase().includes(s)));
    }

    setShownTemplates(_templates);

    return () => {
      clearTimeout(timeoutId as NodeJS.Timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

  const onSearchChange = event => {
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

  const onCategoryClick = categoryTitle => {
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
    <TextField
      fullWidth
      label="Search"
      size="small"
      sx={{ marginBottom: "1rem" }}
      disabled={isLoadingTemplates}
      value={searchTerms}
      onChange={onSearchChange}
      InputProps={{
        endAdornment: searchTerms && (
          <IconButton onClick={onClearSearch} size="small">
            <Xmark className="text-sm" />
          </IconButton>
        )
      }}
    />
  );

  return (
    <PageContainer isLoading={isLoadingTemplates}>
      <div className="mb-6 text-center sm:mb-8 md:mb-12">
        <h1 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">Find your Template</h1>

        <h3 className="text-lg text-muted-foreground sm:text-xl md:text-2xl">Jumpstart your app development process with our pre-built solutions.</h3>
      </div>

      <div className="mb-4 block md:hidden">
        {searchBar}

        <Button onClick={() => setIsMobileSearchOpen(true)} className="flex w-full items-center" color="primary">
          Filter Templates
          <FilterList className="ml-2" />
        </Button>
        <MobileTemplatesFilter
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
            <p className="mb-4 font-bold">Filter Templates</p>

            {searchBar}

            <ul className="flex flex-col items-start">
              {templates && (
                <li
                  className={cn({ ["bg-muted-foreground/10"]: !selectedCategoryTitle }, buttonVariants({ variant: "ghost" }), "h-8 w-full justify-start px-4 py-0")}
                  onClick={() => onCategoryClick(null)}
                >
                  All <small className="ml-2">({templates.length - 1})</small>
                </li>
              )}

              {categories
                .sort((a, b) => (a.title < b.title ? -1 : 1))
                .map(category => (
                  <li
                    key={category.title}
                    className={cn(
                      { ["bg-muted-foreground/10"]: category.title === selectedCategoryTitle },
                      buttonVariants({ variant: "ghost" }),
                      "h-8 w-full justify-start px-4 py-0"
                    )}
                    onClick={() => onCategoryClick(category.title)}
                  >
                    {category.title} <small className="ml-2">({category.templates.length})</small>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="flex-1">
          {searchTerms && (
            <div className="flex items-center pb-4">
              <p className="text-muted-foreground">
                Searching for: "{searchTerms}" - {shownTemplates.length} results
              </p>

              <div className="ml-4 inline-flex">
                <LinkTo onClick={onClearSearch}>Clear</LinkTo>
              </div>
            </div>
          )}

          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3"
            // sx={{ gridTemplateColumns: { xs: "repeat(1,1fr)", sm: "repeat(2,1fr)", md: "repeat(2,1fr)", lg: "repeat(3,1fr)" }, display: "grid", gap: "1rem" }}
          >
            {shownTemplates.map((template, id) => (
              <TemplateBox key={`${template.id}_${id}`} template={template} />
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
    </PageContainer>
  );
};