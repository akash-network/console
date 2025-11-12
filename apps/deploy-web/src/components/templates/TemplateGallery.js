"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateGallery = void 0;
var react_1 = require("react");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var IconButton_1 = require("@mui/material/IconButton");
var TextField_1 = require("@mui/material/TextField");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var LinkTo_1 = require("@src/components/shared/LinkTo");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var Title_1 = require("../shared/Title");
var MobileTemplatesFilter_1 = require("./MobileTemplatesFilter");
var TemplateBox_1 = require("./TemplateBox");
var timeoutId = null;
var TemplateGallery = function () {
    var _a;
    var _b = (0, react_1.useState)(null), selectedCategoryTitle = _b[0], setSelectedCategoryTitle = _b[1];
    var _c = (0, react_1.useState)(""), searchTerms = _c[0], setSearchTerms = _c[1];
    var _d = (0, react_1.useState)([]), shownTemplates = _d[0], setShownTemplates = _d[1];
    var _e = (0, useTemplateQuery_1.useTemplates)(), isLoadingTemplates = _e.isLoading, categories = _e.categories, templates = _e.templates;
    var router = (0, navigation_1.useRouter)();
    var _f = (0, react_1.useState)(false), isMobileSearchOpen = _f[0], setIsMobileSearchOpen = _f[1];
    var searchParams = (0, navigation_1.useSearchParams)();
    (0, react_1.useEffect)(function () {
        var queryCategory = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("category");
        var querySearch = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("search");
        if (queryCategory) {
            setSelectedCategoryTitle(queryCategory);
        }
        if (querySearch) {
            setSearchTerms(querySearch);
        }
    }, []);
    (0, react_1.useEffect)(function () {
        var queryCategory = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("category");
        var querySearch = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("search");
        var _templates = [];
        if (queryCategory) {
            var selectedCategory = categories.find(function (x) { return x.title === queryCategory; });
            _templates = (selectedCategory === null || selectedCategory === void 0 ? void 0 : selectedCategory.templates) || [];
        }
        else {
            _templates = templates;
        }
        if (querySearch) {
            // TODO: use minisearch instead https://lucaong.github.io/minisearch/
            var searchTermsSplit_1 = querySearch === null || querySearch === void 0 ? void 0 : querySearch.split(" ").map(function (x) { return x.toLowerCase(); });
            _templates = templates.filter(function (x) { return searchTermsSplit_1.some(function (s) { var _a, _b; return ((_a = x.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(s)) || ((_b = x.summary) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(s)); }); });
        }
        setShownTemplates(_templates);
        return function () {
            clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, templates]);
    var onSearchChange = function (event) {
        var searchValue = event.target.value;
        setSearchTerms(searchValue);
        if (searchValue) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(function () {
                router.replace(urlUtils_1.UrlService.templates(selectedCategoryTitle || "", searchValue));
            }, 300);
        }
        else {
            router.replace(urlUtils_1.UrlService.templates(selectedCategoryTitle || "", ""));
        }
    };
    var onCategoryClick = function (categoryTitle) {
        setSelectedCategoryTitle(categoryTitle);
        if (isMobileSearchOpen) {
            setIsMobileSearchOpen(false);
        }
        router.replace(urlUtils_1.UrlService.templates(categoryTitle, searchTerms));
    };
    var onClearSearch = function () {
        setSearchTerms("");
        router.replace(urlUtils_1.UrlService.templates(selectedCategoryTitle || "", ""));
    };
    var searchBar = (<TextField_1.default fullWidth label="Search" size="small" sx={{ marginBottom: "1rem" }} disabled={isLoadingTemplates} value={searchTerms} onChange={onSearchChange} InputProps={{
            endAdornment: searchTerms && (<IconButton_1.default onClick={onClearSearch} size="small">
            <iconoir_react_1.Xmark className="text-sm"/>
          </IconButton_1.default>)
        }}/>);
    return (<Layout_1.default isLoading={isLoadingTemplates}>
      <CustomNextSeo_1.CustomNextSeo title="Template Gallery" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.templates())} description="Explore all the templates made by the community to easily deploy any docker container on the Akash Network."/>

      <div className="mb-6 text-center sm:mb-8 md:mb-12">
        <Title_1.Title className="mb-2 text-2xl font-bold sm:text-3xl md:text-4xl">Find your Template</Title_1.Title>

        <Title_1.Title subTitle className="text-base font-normal text-muted-foreground sm:text-lg">
          Jumpstart your app development process with our pre-built solutions.
        </Title_1.Title>
      </div>

      <div className="mb-4 block md:hidden">
        {searchBar}

        <components_1.Button onClick={function () { return setIsMobileSearchOpen(true); }} className="flex w-full items-center" variant="outline">
          Filter Templates
          <iconoir_react_1.FilterList className="ml-2 text-xs"/>
        </components_1.Button>
        <MobileTemplatesFilter_1.MobileTemplatesFilter handleDrawerToggle={function () { return setIsMobileSearchOpen(function (prev) { return !prev; }); }} isOpen={isMobileSearchOpen} templates={templates} categories={categories} onCategoryClick={onCategoryClick} selectedCategoryTitle={selectedCategoryTitle}/>

        {selectedCategoryTitle && !searchTerms && <p className="mt-4 font-bold">{selectedCategoryTitle}</p>}
      </div>

      <div className="flex">
        {templates.length > 0 && (<div className="mr-12 hidden w-[222px] md:block">
            <p className="mb-4 font-bold">Filter Templates</p>

            {searchBar}

            <ul className="flex flex-col items-start">
              {templates && (<li className={(0, utils_1.cn)((_a = {}, _a["bg-muted-foreground/10"] = !selectedCategoryTitle, _a), (0, components_1.buttonVariants)({ variant: "ghost" }), "h-8 w-full justify-start px-4 py-0")} onClick={function () { return onCategoryClick(null); }}>
                  All{" "}
                  <span className="text-xs">
                    <small className="ml-2 text-muted-foreground">({templates.length - 1})</small>
                  </span>
                </li>)}

              {categories
                .sort(function (a, b) { return (a.title < b.title ? -1 : 1); })
                .map(function (category) {
                var _a;
                return (<li key={category.title} className={(0, utils_1.cn)((_a = {}, _a["bg-muted-foreground/10"] = category.title === selectedCategoryTitle, _a), (0, components_1.buttonVariants)({ variant: "ghost" }), "h-8 w-full justify-start px-4 py-0")} onClick={function () { return onCategoryClick(category.title); }}>
                    {category.title}{" "}
                    <span className="text-xs">
                      <small className="ml-2 text-muted-foreground">({category.templates.length})</small>
                    </span>
                  </li>);
            })}
            </ul>
          </div>)}

        <div className="flex-1">
          {searchTerms && (<div className="flex items-center pb-4">
              <p className="text-muted-foreground">
                Searching for: "{searchTerms}" - {shownTemplates.length} results
              </p>

              <div className="ml-4 inline-flex">
                <LinkTo_1.LinkTo onClick={onClearSearch}>Clear</LinkTo_1.LinkTo>
              </div>
            </div>)}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {shownTemplates.map(function (template, id) { return (<TemplateBox_1.TemplateBox key={"".concat(template.id, "_").concat(id)} template={template}/>); })}
          </div>

          {isLoadingTemplates && (<div className="mt-8 flex items-center justify-center">
              <components_1.Spinner size="large"/>
            </div>)}

          {!isLoadingTemplates && categories.length > 0 && shownTemplates.length === 0 && (!!searchTerms || !!selectedCategoryTitle) && (<div className="flex h-[200px] flex-col items-center justify-center border border-muted-foreground">
              <md_1.MdSearchOff className="mb-4 text-6xl"/>
              <p>No search result found. Try adjusting your filters.</p>
            </div>)}
        </div>
      </div>
    </Layout_1.default>);
};
exports.TemplateGallery = TemplateGallery;
