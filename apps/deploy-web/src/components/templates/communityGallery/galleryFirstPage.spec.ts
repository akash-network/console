import { describe, expect, it } from "vitest";

import { toCategoriesAndTemplates } from "@src/queries/templateCategories";
import type { CommunityTemplateGallery } from "@src/types/marketplace-template";
import { buildGalleryFirstPage } from "./galleryFirstPage";
import type { GalleryView } from "./galleryView";

import { buildCommunityTemplateCard } from "@tests/seeders/communityTemplate";

const DEFAULT_VIEW: GalleryView = { category: null, search: "", source: "all", sort: "popular" };

describe(buildGalleryFirstPage.name, () => {
  it("answers the first 24 entries of the default view with the counts of the whole gallery", () => {
    const firstPage = setup({ view: DEFAULT_VIEW, communityCount: 30 });

    expect(firstPage.view).toEqual(DEFAULT_VIEW);
    expect(firstPage.selectedCategory).toBeNull();
    expect(firstPage.shownEntries).toHaveLength(24);
    expect(firstPage.shownEntries[0].title).toBe("Community 29");
    expect(firstPage.sourceCounts).toEqual({ all: 32, official: 2, community: 30 });
    expect(firstPage.filters).toEqual([
      { category: null, label: "All", count: 32 },
      { category: "AI - GPU", label: "AI - GPU", count: 1 },
      { category: "Tools", label: "Tools", count: 31 }
    ]);
  });

  it("answers the view the link asks for: its category, source, sort and search", () => {
    const firstPage = setup({ view: { category: "Tools", search: "community 9", source: "community", sort: "newest" }, communityCount: 30 });

    expect(firstPage.selectedCategory).toBe("Tools");
    expect(firstPage.shownEntries.map(entry => entry.title)).toEqual(["Community 29", "Community 19", "Community 09"]);
    expect(firstPage.sourceCounts).toEqual({ all: 31, official: 1, community: 30 });
    expect(firstPage.filters.map(filter => filter.count)).toEqual([30, 0, 30]);
  });

  it("reads a category the gallery does not have as no category", () => {
    const firstPage = setup({ view: { ...DEFAULT_VIEW, category: "Nonsense" }, communityCount: 1 });

    expect(firstPage.selectedCategory).toBeNull();
    expect(firstPage.shownEntries).toHaveLength(3);
  });

  it("answers the trending row once enough templates trend, and hides it under a search", () => {
    const trending = setup({ view: DEFAULT_VIEW, communityCount: 5, trendingCount: 3, trendingRowMinTemplates: 3 });
    const tooFew = setup({ view: DEFAULT_VIEW, communityCount: 5, trendingCount: 3, trendingRowMinTemplates: 4 });
    const searching = setup({ view: { ...DEFAULT_VIEW, search: " community " }, communityCount: 5, trendingCount: 3, trendingRowMinTemplates: 3 });

    expect(trending.trendingEntries.map(entry => entry.title)).toEqual(["Community 04", "Community 03", "Community 02"]);
    expect(tooFew.trendingEntries).toEqual([]);
    expect(searching.trendingEntries).toEqual([]);
  });

  function setup(input: { view: GalleryView; communityCount: number; trendingCount?: number; trendingRowMinTemplates?: number }) {
    const { categories } = toCategoriesAndTemplates([
      { title: "AI - GPU", templates: [{ id: "llama", name: "Llama", summary: "Chat", deploy: "" }] },
      { title: "Tools", templates: [{ id: "grafana", name: "Grafana", summary: "Dashboards", deploy: "" }] }
    ]);
    const firstTrendingIndex = input.communityCount - (input.trendingCount ?? 0);
    const community: CommunityTemplateGallery = {
      templates: Array.from({ length: input.communityCount }, (_, index) =>
        buildCommunityTemplateCard({
          title: `Community ${String(index).padStart(2, "0")}`,
          categories: ["Tools"],
          publishedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
          usage: { deploys: index + 1, stillUpAfter24h: null, forks: 0 },
          scores: { popular: index + 1, trending: index, isTrending: index >= firstTrendingIndex }
        })
      ),
      officialUsage: {},
      trendingRowMinTemplates: input.trendingRowMinTemplates ?? 3
    };

    return buildGalleryFirstPage({ categories, community, view: input.view });
  }
});
