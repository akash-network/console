import React from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GalleryEntryListProps } from "@src/components/templates/communityGallery/GalleryEntryList/GalleryEntryList";
import type { GalleryFirstPage } from "@src/components/templates/communityGallery/galleryFirstPage";
import type { CommunityGallery, CommunityGalleryInput } from "@src/components/templates/communityGallery/useCommunityGallery";
import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { UrlService } from "@src/utils/urlUtils";
import type { TemplateCardProps } from "./TemplateCard/TemplateCard";
import type { TemplateUseCaseNavProps } from "./TemplateUseCaseNav/TemplateUseCaseNav";
import { TemplateUseCaseNav } from "./TemplateUseCaseNav/TemplateUseCaseNav";
import type { DEPENDENCIES as URL_STATE_DEPENDENCIES } from "./useTemplateGalleryUrlState/useTemplateGalleryUrlState";
import { useTemplateGalleryUrlState } from "./useTemplateGalleryUrlState/useTemplateGalleryUrlState";
import { DEPENDENCIES, TemplateGallery } from "./TemplateGallery";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGalleryEntry } from "@tests/seeders/communityTemplate";
import { MockComponents } from "@tests/unit/mocks";

describe(TemplateGallery.name, () => {
  it("shows one section per category when showing all templates", () => {
    setup({ categories: [makeCategory("AI - GPU", ["Llama 3", "ComfyUI"]), makeCategory("Games", ["Minecraft"])] });

    const aiSection = screen.getByRole("region", { name: "AI - GPU" });
    expect(within(aiSection).getByText("Llama 3")).toBeInTheDocument();
    expect(within(aiSection).getByText("ComfyUI")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Games" })).getByText("Minecraft")).toBeInTheDocument();
  });

  it("shows only the category named in the link", () => {
    setup({ categories: [makeCategory("AI - GPU", ["Llama 3"]), makeCategory("Games", ["Minecraft"])], url: { category: "Games" } });

    expect(screen.getByRole("region", { name: "Games" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "AI - GPU" })).not.toBeInTheDocument();
  });

  it("shows all templates when the link names a category that no longer exists", () => {
    setup({ categories: [makeCategory("AI - GPU", ["Llama 3"]), makeCategory("Games", ["Minecraft"])], url: { category: "Retired" } });

    expect(screen.getByRole("region", { name: "AI - GPU" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Games" })).toBeInTheDocument();
  });

  it("passes the use case filters and the selected category to the rail", () => {
    const { TemplateUseCaseNav } = setup({ categories: [makeCategory("AI - GPU", ["Llama 3", "ComfyUI"])], url: { category: "AI - GPU" } });

    expect(TemplateUseCaseNav).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          { category: null, label: "All", count: 2 },
          { category: "AI - GPU", label: "AI - GPU", count: 2 }
        ],
        selectedCategory: "AI - GPU"
      }),
      {}
    );
  });

  it("puts the picked category in the link and keeps the search", () => {
    const { router, TemplateUseCaseNav } = setup({ categories: [makeCategory("Games", ["Minecraft"])], url: { search: "craft" } });

    act(() => TemplateUseCaseNav.mock.calls[0][0].onSelect("Games"));

    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=craft");
  });

  it("drops the category from the link when All is picked", () => {
    const { router, TemplateUseCaseNav } = setup({ categories: [makeCategory("Games", ["Minecraft"])], url: { category: "Games" } });

    act(() => TemplateUseCaseNav.mock.calls[0][0].onSelect(null));

    expect(router.replace).toHaveBeenCalledWith("/templates");
  });

  it("starts from the search in the link", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { search: "tetris" } });

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("tetris");
    expect(screen.getByText("Tetris")).toBeInTheDocument();
    expect(screen.queryByText("Minecraft")).not.toBeInTheDocument();
  });

  it("narrows the templates as the user types", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mine" } });

    expect(screen.getByText("Minecraft")).toBeInTheDocument();
    expect(screen.queryByText("Tetris")).not.toBeInTheDocument();
  });

  it("puts the search in the link once the user stops typing, keeping the category", async () => {
    const { router } = setup({ categories: [makeCategory("Games", ["Minecraft"])], url: { category: "Games" } });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mi" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mine" } });

    expect(router.replace).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=mine"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("clears the search and drops it from the link", async () => {
    const { router } = setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { category: "Games", search: "tetris" } });

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("");
    expect(screen.getByText("Minecraft")).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games");
  });

  it("offers no clear button while the search is empty", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])] });

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("takes the search from the link when it changes outside the page", () => {
    const { rerenderWithUrl } = setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { search: "tetris" } });

    rerenderWithUrl({ search: "mine" });

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("mine");
    expect(screen.getByText("Minecraft")).toBeInTheDocument();
  });

  it("does not write back a search it just put in the link", async () => {
    const { router, rerenderWithUrl } = setup({ categories: [makeCategory("Games", ["Minecraft"])] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mine" } });
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    rerenderWithUrl({ search: "mine" });

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("mine");
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("says nothing matches when the search finds no template, quoting the search without its spaces", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "  postgres " } });

    expect(screen.getByText("No templates match “postgres”")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("does not show the no-match message while templates load", () => {
    setup({ categories: [], isLoading: true, url: { search: "postgres" } });

    expect(screen.queryByText(/No templates match/)).not.toBeInTheDocument();
  });

  it("does not claim nothing matches when no template could be loaded", () => {
    setup({ categories: [], isLoading: false, url: { search: "postgres" } });

    expect(screen.queryByText(/No templates match/)).not.toBeInTheDocument();
  });

  it("shows a spinner while the templates load for the first time", () => {
    setup({ categories: [], isLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps the templates on screen without a spinner while they refresh", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])], isLoading: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Minecraft")).toBeInTheDocument();
  });

  it("shows the templates and their counts once they load", () => {
    const { rerenderWithTemplates, TemplateUseCaseNav } = setup({ categories: [], isLoading: true });

    rerenderWithTemplates([makeCategory("Games", ["Minecraft"])]);

    expect(screen.getByText("Minecraft")).toBeInTheDocument();
    expect(TemplateUseCaseNav).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: expect.arrayContaining([{ category: "Games", label: "Games", count: 1 }]) }),
      {}
    );
  });

  it("offers no small screen filter before any template loads", () => {
    setup({ categories: [], isLoading: true });

    expect(screen.queryByRole("button", { name: /Filter by use case/ })).not.toBeInTheDocument();
  });

  it("marks popular templates for their card", () => {
    const { TemplateCard } = setup({
      categories: [{ title: "Games", templates: [makeTemplate({ name: "Minecraft", tags: ["popular"] }), makeTemplate({ name: "Tetris" })] }]
    });

    expect(TemplateCard).toHaveBeenCalledWith(expect.objectContaining({ template: expect.objectContaining({ name: "Minecraft" }), isPopular: true }), {});
    expect(TemplateCard).toHaveBeenCalledWith(expect.objectContaining({ template: expect.objectContaining({ name: "Tetris" }), isPopular: false }), {});
  });

  it("filters from a sheet on small screens and closes it after a pick", async () => {
    const { router } = setup({
      categories: [makeCategory("AI - GPU", ["Llama 3"]), makeCategory("Games", ["Minecraft"])],
      dependencies: { TemplateUseCaseNav }
    });

    await userEvent.click(screen.getByRole("button", { name: "Filter by use case: All 2" }));
    const sheet = screen.getByRole("dialog", { name: "Filter by use case" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Games 1" }));

    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the selected use case on the small screen filter button", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { category: "Games" } });

    expect(screen.getByRole("button", { name: "Filter by use case: Games 2" })).toBeInTheDocument();
  });

  it("links to My templates only when template_marketplace is on", () => {
    const categories = [makeCategory("Games", ["Minecraft"])];
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(flag => flag === "template_marketplace");
    const { rerenderWithTemplates } = setup({ categories, dependencies: { useFlag } });

    expect(screen.getByRole("link", { name: "My templates" })).toHaveAttribute("href", UrlService.myTemplates());

    useFlag.mockReturnValue(false);
    rerenderWithTemplates(categories);

    expect(screen.queryByRole("link", { name: "My templates" })).not.toBeInTheDocument();
  });

  it("offers a visitor no link to My templates", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])], isSignedIn: false, dependencies: { useFlag: flag => flag === "template_marketplace" } });

    expect(screen.queryByRole("link", { name: "My templates" })).not.toBeInTheDocument();
  });

  it("puts the organization section above the category sections and keeps it while searching", () => {
    const OrganizationTemplatesSection = vi.fn(() => <section aria-label="Your organization" />);
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { search: "tetris" }, dependencies: { OrganizationTemplatesSection } });

    const organization = screen.getByRole("region", { name: "Your organization" });
    const games = screen.getByRole("region", { name: "Games" });
    expect(organization.compareDocumentPosition(games) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(OrganizationTemplatesSection).toHaveBeenCalledWith({}, {});
  });

  function makeCategory(title: string, names: string[]): EnhancedTemplateCategory {
    return { title, templates: names.map(name => makeTemplate({ name, category: title })) };
  }

  function makeTemplate(partial: Partial<TemplateOutputSummaryWithCategory>): TemplateOutputSummaryWithCategory {
    return {
      id: partial.id ?? `template-${partial.name}`,
      name: partial.name ?? "Template",
      summary: partial.summary ?? `${partial.name} summary`,
      deploy: "",
      logoUrl: null,
      category: partial.category ?? "Games",
      tags: partial.tags
    };
  }

  describe("when template_marketplace is on", () => {
    const CATEGORIES = [makeCategory("Games", ["Minecraft"])];

    it("builds the community gallery from the categories and the view in the link", () => {
      const { useCommunityGallery } = setupMarketplace({ url: { category: "Games", search: "craft", source: "community", sort: "newest" } });

      expect(useCommunityGallery).toHaveBeenLastCalledWith({
        isEnabled: true,
        categories: CATEGORIES,
        isLoadingCategories: false,
        firstPage: undefined,
        view: expect.objectContaining({ category: "Games", search: "craft", source: "community", sort: "newest" })
      });
    });

    it("keeps the community gallery off while the flag is off", () => {
      const useCommunityGallery = vi.fn<typeof DEPENDENCIES.useCommunityGallery>(() => null);
      setup({ categories: CATEGORIES, dependencies: { useCommunityGallery } });

      expect(useCommunityGallery).toHaveBeenLastCalledWith(expect.objectContaining({ isEnabled: false }));
      expect(screen.getByRole("region", { name: "Games" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Show templates from" })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Sort by" })).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveAttribute("placeholder", "Search templates");
    });

    it("lists both sources in one list instead of a section per category", () => {
      const shownEntries = [buildGalleryEntry({ title: "Open WebUI" }), buildGalleryEntry({ title: "Llama" })];
      const { GalleryEntryList } = setupMarketplace({ gallery: { shownEntries }, url: { search: "web" } });

      expect(GalleryEntryList.mock.lastCall?.[0]).toMatchObject({
        title: "All templates · Popular",
        entries: shownEntries,
        search: "web",
        showsCommunityNote: true
      });
      expect(screen.queryByRole("region", { name: "Games" })).not.toBeInTheDocument();
    });

    it("titles the list after the source and the sort, and leaves the community note out of Official", () => {
      const { GalleryEntryList, rerenderWithUrl } = setupMarketplace({ url: { source: "official", sort: "trending" } });

      expect(GalleryEntryList.mock.lastCall?.[0]).toMatchObject({ title: "Official templates · Trending", showsCommunityNote: false });

      rerenderWithUrl({ source: "community", sort: "newest" });

      expect(GalleryEntryList.mock.lastCall?.[0]).toMatchObject({ title: "Community templates · Newest", showsCommunityNote: true });
    });

    it.each([
      ["source", { source: "official" }],
      ["sort", { sort: "newest" }],
      ["category", { category: "Games" }],
      ["search", { search: "craft" }]
    ])("starts the list over at its first page when the %s changes", (_, url) => {
      const { countListMounts, rerenderWithUrl } = setupMarketplace({});

      rerenderWithUrl({});
      expect(countListMounts()).toBe(1);

      rerenderWithUrl(url);
      expect(countListMounts()).toBe(2);
    });

    it("shows the source filter with the gallery's counts and puts the picked source in the link", async () => {
      const { router } = setupMarketplace({ gallery: { sourceCounts: { all: 12, official: 8, community: 4 } }, url: { category: "Games" } });

      expect(screen.getByRole("button", { name: "All 12" })).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(screen.getByRole("button", { name: "Community 4" }));

      expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&source=community");
      expect(screen.getByRole("button", { name: "Community 4" })).toHaveAttribute("aria-pressed", "true");
    });

    it("shows the sort from the link and puts the picked sort in the link", async () => {
      const { router } = setupMarketplace({ url: { sort: "trending" } });

      expect(within(screen.getByRole("group", { name: "Sort by" })).getByRole("button", { name: "Trending" })).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(screen.getByRole("button", { name: "Newest" }));

      expect(router.replace).toHaveBeenCalledWith("/templates?sort=newest");
    });

    it("passes the gallery's use case filters and selected category to the rail", () => {
      const filters = [
        { category: null, label: "All", count: 9 },
        { category: "Wallet", label: "Wallet", count: 2 }
      ];
      const { TemplateUseCaseNav } = setupMarketplace({ gallery: { filters }, url: { category: "Wallet" } });

      expect(TemplateUseCaseNav).toHaveBeenLastCalledWith(expect.objectContaining({ filters, selectedCategory: "Wallet" }), expect.anything());
      expect(screen.getByRole("button", { name: "Filter by use case: Wallet 2" })).toBeInTheDocument();
    });

    it("hands the trending templates to the trending row", () => {
      const trendingEntries = [buildGalleryEntry(), buildGalleryEntry(), buildGalleryEntry()];
      const { TrendingTemplatesRow } = setupMarketplace({ gallery: { trendingEntries } });

      expect(TrendingTemplatesRow).toHaveBeenLastCalledWith({ entries: trendingEntries }, expect.anything());
    });

    it("searches publishers too", () => {
      setupMarketplace({});

      expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveAttribute("placeholder", "Search templates or publishers");
    });

    it("waits for the community gallery before listing anything", () => {
      const { GalleryEntryList } = setupMarketplace({ gallery: { isLoadingCommunity: true } });

      expect(screen.getByRole("status", { name: "Loading community templates" })).toBeInTheDocument();
      expect(GalleryEntryList).not.toHaveBeenCalled();
    });

    it("shows no loading state once the community gallery is there", () => {
      const { GalleryEntryList } = setupMarketplace({});

      expect(screen.queryByRole("status", { name: "Loading community templates" })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(GalleryEntryList).toHaveBeenCalled();
    });

    it("says community templates could not be loaded, still lists the rest and retries on request", async () => {
      const retryCommunity = vi.fn();
      const { GalleryEntryList } = setupMarketplace({ gallery: { hasCommunityFailed: true, retryCommunity } });

      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load community templates. Official templates are listed without their usage numbers.");
      expect(GalleryEntryList).toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(retryCommunity).toHaveBeenCalledOnce();
    });

    it("hands the hook the first screen the server worked out and whether the awesome-akash list is still loading", () => {
      const firstPage = mock<GalleryFirstPage>();
      const { useCommunityGallery, rerenderWithTemplates } = setupMarketplace({ firstPage, categories: [], isLoading: true });

      expect(useCommunityGallery).toHaveBeenLastCalledWith(expect.objectContaining({ firstPage, isLoadingCategories: true, categories: [] }));

      rerenderWithTemplates(CATEGORIES);

      expect(useCommunityGallery).toHaveBeenLastCalledWith(expect.objectContaining({ firstPage, isLoadingCategories: false, categories: CATEGORIES }));
    });

    it("counts a refresh of a list it already has as loaded", () => {
      const { useCommunityGallery } = setupMarketplace({ isLoading: true });

      expect(useCommunityGallery).toHaveBeenLastCalledWith(expect.objectContaining({ isLoadingCategories: false }));
    });

    it("shows no spinner over the first screen the server worked out", () => {
      setupMarketplace({ gallery: { isShowingFirstPage: true }, categories: [], isLoading: true });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows the spinner while the lists load and there is no first screen to show", () => {
      setupMarketplace({ gallery: { isShowingFirstPage: false }, categories: [], isLoading: true });

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("leaves the no-match message to the list", () => {
      setupMarketplace({ gallery: { shownEntries: [] }, url: { search: "zzz" } });

      expect(screen.queryByText("No templates match “zzz”")).not.toBeInTheDocument();
    });

    function setupMarketplace(input: {
      gallery?: Partial<CommunityGallery>;
      url?: GalleryUrl;
      firstPage?: GalleryFirstPage;
      categories?: EnhancedTemplateCategory[];
      isLoading?: boolean;
    }) {
      const gallery: CommunityGallery = {
        selectedCategory: null,
        filters: [{ category: null, label: "All", count: 1 }],
        sourceCounts: { all: 1, official: 1, community: 0 },
        shownEntries: [],
        trendingEntries: [],
        isShowingFirstPage: false,
        isLoadingCommunity: false,
        hasCommunityFailed: false,
        retryCommunity: vi.fn(),
        ...input.gallery
      };
      const useCommunityGallery = vi.fn<typeof DEPENDENCIES.useCommunityGallery>((galleryInput: CommunityGalleryInput) => ({
        ...gallery,
        selectedCategory: galleryInput.view.category
      }));
      let listMounts = 0;
      const GalleryEntryList = vi.fn((_props: GalleryEntryListProps) => {
        React.useState(() => ++listMounts);
        return null;
      });
      const TrendingTemplatesRow = vi.fn((_props: Parameters<typeof DEPENDENCIES.TrendingTemplatesRow>[0]) => null);

      const rendered = setup({
        categories: input.categories ?? CATEGORIES,
        isLoading: input.isLoading,
        firstPage: input.firstPage,
        url: input.url,
        dependencies: { useFlag: flag => flag === "template_marketplace", useCommunityGallery, GalleryEntryList, TrendingTemplatesRow }
      });

      return { ...rendered, useCommunityGallery, GalleryEntryList, TrendingTemplatesRow, countListMounts: () => listMounts };
    }
  });

  type GalleryUrl = { category?: string; search?: string; source?: string; sort?: string };

  function setup(input: {
    categories: EnhancedTemplateCategory[];
    isLoading?: boolean;
    isSignedIn?: boolean;
    firstPage?: GalleryFirstPage;
    url?: GalleryUrl;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const router = mock<ReturnType<typeof URL_STATE_DEPENDENCIES.useRouter>>();
    let templatesResult = toTemplatesResult(input.categories, input.isLoading ?? false);
    let searchParams = toSearchParams(input.url);
    const TemplateCard = vi.fn(({ template }: TemplateCardProps) => <div>{template.name}</div>);
    const TemplateUseCaseNav = vi.fn((_props: TemplateUseCaseNavProps) => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      useTemplateGalleryUrlState: () => useTemplateGalleryUrlState({ useRouter: () => router, useSearchParams: () => searchParams }),
      useTemplates: () => templatesResult,
      useCustomUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ user: input.isSignedIn === false ? undefined : { userId: "auth0|ada" }, isLoading: false }),
      TemplateCard,
      TemplateUseCaseNav,
      ...input.dependencies
    });

    const { rerender } = render(<TemplateGallery firstPage={input.firstPage} dependencies={dependencies} />);

    const rerenderWithUrl = (url: GalleryUrl) => {
      searchParams = toSearchParams(url);
      rerender(<TemplateGallery firstPage={input.firstPage} dependencies={dependencies} />);
    };

    const rerenderWithTemplates = (categories: EnhancedTemplateCategory[]) => {
      templatesResult = toTemplatesResult(categories, false);
      rerender(<TemplateGallery firstPage={input.firstPage} dependencies={dependencies} />);
    };

    return { router, TemplateCard, TemplateUseCaseNav, rerenderWithUrl, rerenderWithTemplates };
  }

  function toTemplatesResult(categories: EnhancedTemplateCategory[], isLoading: boolean) {
    return { isLoading, categories, templates: categories.flatMap(category => category.templates) };
  }

  function toSearchParams(url: GalleryUrl = {}) {
    const params = new URLSearchParams();
    if (url.category) params.set("category", url.category);
    if (url.search) params.set("search", url.search);
    if (url.source) params.set("source", url.source);
    if (url.sort) params.set("sort", url.sort);
    return new ReadonlyURLSearchParams(params);
  }
});
