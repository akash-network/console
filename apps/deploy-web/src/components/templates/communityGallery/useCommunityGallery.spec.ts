import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnhancedTemplateCategory } from "@src/queries/useTemplateQuery";
import type { CommunityTemplateGallery } from "@src/types/marketplace-template";
import type { GallerySort, GallerySource } from "./galleryView";
import type { CommunityGallery, CommunityGalleryInput, DEPENDENCIES } from "./useCommunityGallery";
import { useCommunityGallery } from "./useCommunityGallery";

import { renderHook } from "@testing-library/react";
import { buildCommunityTemplateCard } from "@tests/seeders/communityTemplate";

type CommunityQuery = ReturnType<typeof DEPENDENCIES.useCommunityTemplates>;

const CATEGORIES: EnhancedTemplateCategory[] = [
  {
    title: "AI - GPU",
    templates: [
      { id: "llama", name: "Llama", summary: "Chat with a model", deploy: "", category: "AI - GPU" },
      { id: "comfy", name: "ComfyUI", summary: "Images", deploy: "", category: "AI - GPU" }
    ]
  },
  { title: "Games", templates: [{ id: "minecraft", name: "Minecraft", summary: "Blocks", deploy: "", category: "Games" }] }
];

const COMMUNITY: CommunityTemplateGallery = {
  templates: [
    buildCommunityTemplateCard({
      title: "Open WebUI",
      categories: ["AI - GPU"],
      publishedAt: "2026-06-01T00:00:00.000Z",
      usage: { deploys: 50, stillUpAfter24h: null, forks: 0 },
      publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false }
    }),
    buildCommunityTemplateCard({
      title: "Pocket wallet",
      categories: ["Wallet"],
      publishedAt: "2026-09-01T00:00:00.000Z",
      usage: { deploys: 5, stillUpAfter24h: null, forks: 0 },
      publisher: { name: "Quarry", handle: "quarry", verified: false }
    })
  ],
  officialUsage: {
    llama: { deploys: 20, stillUpAfter24h: null, forks: 0, scores: { popular: null, trending: null, isTrending: false } },
    minecraft: { deploys: 70, stillUpAfter24h: null, forks: 0, scores: { popular: null, trending: null, isTrending: false } }
  },
  trendingRowMinTemplates: 3
};

describe(useCommunityGallery.name, () => {
  it("is off and asks for nothing while the marketplace is off", () => {
    const { result, useCommunityTemplates } = setup({ isEnabled: false });

    expect(result.current).toBeNull();
    expect(useCommunityTemplates).toHaveBeenCalledWith({ enabled: false });
  });

  it("lists both sources together, most deployed first", () => {
    const { result, useCommunityTemplates } = setup({});

    expect(useCommunityTemplates).toHaveBeenCalledWith({ enabled: true });
    expect(titlesOf(result)).toEqual(["Minecraft", "Open WebUI", "Llama", "Pocket wallet", "ComfyUI"]);
  });

  it("counts the sources and the use cases, a community-only category after the gallery's own", () => {
    const { result } = setup({});

    expect(galleryOf(result).sourceCounts).toEqual({ all: 5, official: 3, community: 2 });
    expect(galleryOf(result).filters).toEqual([
      { category: null, label: "All", count: 5 },
      { category: "AI - GPU", label: "AI - GPU", count: 3 },
      { category: "Games", label: "Games", count: 1 },
      { category: "Wallet", label: "Wallet", count: 1 }
    ]);
  });

  it("shows only the source in the view and counts the use cases within it", () => {
    const { result } = setup({ view: { source: "community" } });

    expect(titlesOf(result)).toEqual(["Open WebUI", "Pocket wallet"]);
    expect(galleryOf(result).filters.map(filter => filter.count)).toEqual([2, 1, 0, 1]);
  });

  it("shows only the category in the view and counts the sources within it", () => {
    const { result } = setup({ view: { category: "AI - GPU" } });

    expect(galleryOf(result).selectedCategory).toBe("AI - GPU");
    expect(titlesOf(result)).toEqual(["Open WebUI", "Llama", "ComfyUI"]);
    expect(galleryOf(result).sourceCounts).toEqual({ all: 3, official: 2, community: 1 });
  });

  it("selects a category only community templates use", () => {
    const { result } = setup({ view: { category: "Wallet" } });

    expect(galleryOf(result).selectedCategory).toBe("Wallet");
    expect(titlesOf(result)).toEqual(["Pocket wallet"]);
  });

  it("falls back to every category when the view names one that does not exist", () => {
    const { result } = setup({ view: { category: "Retired" } });

    expect(galleryOf(result).selectedCategory).toBeNull();
    expect(titlesOf(result)).toHaveLength(5);
  });

  it("searches titles, summaries and publishers across both sources", () => {
    const { result } = setup({ view: { search: "chat" } });
    expect(titlesOf(result)).toEqual(["Llama"]);

    const byPublisher = setup({ view: { search: "garage" } });
    expect(titlesOf(byPublisher.result)).toEqual(["Open WebUI"]);
  });

  it("sorts by the sort in the view", () => {
    const { result } = setup({ view: { sort: "newest" } });

    expect(titlesOf(result)).toEqual(["Pocket wallet", "Open WebUI", "Minecraft", "Llama", "ComfyUI"]);
  });

  it("follows the view and the data as they change", () => {
    const { result, rerenderWith } = setup({});

    rerenderWith({ view: { sort: "newest" } });
    expect(titlesOf(result)[0]).toBe("Pocket wallet");

    rerenderWith({ view: { source: "official" } });
    expect(titlesOf(result)).toEqual(["Minecraft", "Llama", "ComfyUI"]);
    expect(galleryOf(result).filters[0].count).toBe(3);

    rerenderWith({ view: { category: "Games" } });
    expect(titlesOf(result)).toEqual(["Minecraft"]);
    expect(galleryOf(result).sourceCounts.all).toBe(1);

    rerenderWith({ view: { search: "comfy" } });
    expect(titlesOf(result)).toEqual(["ComfyUI"]);

    rerenderWith({ categories: [CATEGORIES[1]] });
    expect(titlesOf(result)).toEqual(["Minecraft", "Open WebUI", "Pocket wallet"]);
    expect(galleryOf(result).filters.map(filter => filter.label)).toEqual(["All", "Games", "AI - GPU", "Wallet"]);

    rerenderWith({ categories: CATEGORIES, community: galleryWith([]) });
    expect(titlesOf(result)).toEqual(["ComfyUI", "Llama", "Minecraft"]);
  });

  it("turns on when the flag does", () => {
    const { result, rerenderWith } = setup({ isEnabled: false });

    rerenderWith({ isEnabled: true });

    expect(titlesOf(result)).toHaveLength(5);
  });

  it("shows only awesome-akash templates, without usage, when the community gallery is not there", () => {
    const { result } = setup({ community: null });

    expect(titlesOf(result)).toEqual(["ComfyUI", "Llama", "Minecraft"]);
    expect(galleryOf(result).sourceCounts).toEqual({ all: 3, official: 3, community: 0 });
  });

  it("offers the trending row only once enough templates trend", () => {
    const trending = [1, 2, 3].map(rank =>
      buildCommunityTemplateCard({ title: `Trending ${rank}`, scores: { popular: null, trending: rank, isTrending: true } })
    );

    expect(galleryOf(setup({}).result).trendingEntries).toEqual([]);
    expect(galleryOf(setup({ community: galleryWith(trending) }).result).trendingEntries.map(entry => entry.title)).toEqual([
      "Trending 3",
      "Trending 2",
      "Trending 1"
    ]);
  });

  it("fills the trending row from as many templates as the API asks for", () => {
    const trending = [1, 2, 3].map(rank =>
      buildCommunityTemplateCard({ title: `Trending ${rank}`, scores: { popular: null, trending: rank, isTrending: true } })
    );

    expect(galleryOf(setup({ community: galleryWith(trending, 4) }).result).trendingEntries).toEqual([]);
    expect(galleryOf(setup({ community: galleryWith(trending.slice(0, 2), 2) }).result).trendingEntries).toHaveLength(2);
  });

  it("brings the trending row in when a refresh of the gallery has enough trending templates", () => {
    const trending = [1, 2, 3].map(rank =>
      buildCommunityTemplateCard({ title: `Trending ${rank}`, scores: { popular: null, trending: rank, isTrending: true } })
    );
    const { result, rerenderWith } = setup({});
    expect(galleryOf(result).trendingEntries).toEqual([]);

    rerenderWith({ community: galleryWith(trending) });

    expect(galleryOf(result).trendingEntries).toHaveLength(3);
  });

  it("hides the trending row while searching, but not for a search of spaces", () => {
    const trending = [1, 2, 3].map(rank =>
      buildCommunityTemplateCard({ title: `Trending ${rank}`, scores: { popular: null, trending: rank, isTrending: true } })
    );
    const community = galleryWith(trending);

    expect(galleryOf(setup({ community, view: { search: "trending" } }).result).trendingEntries).toEqual([]);
    expect(galleryOf(setup({ community, view: { search: "   " } }).result).trendingEntries).toHaveLength(3);
  });

  it("reports the first load and a failure of the community gallery", () => {
    expect(galleryOf(setup({}).result)).toMatchObject({ isLoadingCommunity: false, hasCommunityFailed: false });
    expect(galleryOf(setup({ community: null, isLoading: true }).result)).toMatchObject({ isLoadingCommunity: true, hasCommunityFailed: false });
    expect(galleryOf(setup({ community: null, isError: true }).result)).toMatchObject({ isLoadingCommunity: false, hasCommunityFailed: true });
  });

  it("asks for the community gallery again on retry", () => {
    const { result, refetch } = setup({ community: null, isError: true });

    galleryOf(result).retryCommunity();

    expect(refetch).toHaveBeenCalledOnce();
  });

  function galleryWith(templates: CommunityTemplateGallery["templates"], trendingRowMinTemplates = 3): CommunityTemplateGallery {
    return { templates, officialUsage: {}, trendingRowMinTemplates };
  }

  function galleryOf(result: { current: CommunityGallery | null }) {
    return result.current as CommunityGallery;
  }

  function titlesOf(result: { current: CommunityGallery | null }) {
    return galleryOf(result).shownEntries.map(entry => entry.title);
  }

  function setup(input: {
    isEnabled?: boolean;
    categories?: EnhancedTemplateCategory[];
    community?: CommunityTemplateGallery | null;
    isLoading?: boolean;
    isError?: boolean;
    view?: { category?: string | null; search?: string; source?: GallerySource; sort?: GallerySort };
  }) {
    const refetch = vi.fn();
    const toQuery = (community: CommunityTemplateGallery | null) =>
      mock<CommunityQuery>({ data: community ?? undefined, isLoading: input.isLoading ?? false, isError: input.isError ?? false, refetch });
    let query = toQuery(input.community === undefined ? COMMUNITY : input.community);
    const useCommunityTemplates = vi.fn<typeof DEPENDENCIES.useCommunityTemplates>(() => query);
    let hookInput: CommunityGalleryInput = {
      isEnabled: input.isEnabled ?? true,
      categories: input.categories ?? CATEGORIES,
      view: { category: null, search: "", source: "all", sort: "popular", ...input.view }
    };

    const { result, rerender } = renderHook(() => useCommunityGallery(hookInput, { useCommunityTemplates }));

    const rerenderWith = (change: {
      isEnabled?: boolean;
      categories?: EnhancedTemplateCategory[];
      community?: CommunityTemplateGallery;
      view?: Partial<CommunityGalleryInput["view"]>;
    }) => {
      if (change.community) query = toQuery(change.community);
      hookInput = {
        isEnabled: change.isEnabled ?? hookInput.isEnabled,
        categories: change.categories ?? hookInput.categories,
        view: { category: null, search: "", source: "all", sort: "popular", ...change.view }
      };
      rerender();
    };

    return { result, rerenderWith, useCommunityTemplates, refetch };
  }
});
