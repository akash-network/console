import { describe, expect, it } from "vitest";

import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import type { CommunityTemplateGallery } from "@src/types/marketplace-template";
import type { GalleryEntry } from "./galleryEntries";
import {
  buildGalleryEntries,
  countGallerySources,
  filterGalleryEntries,
  GALLERY_PAGE_SIZE,
  listGalleryCategories,
  listGalleryUseCaseFilters,
  MAX_TRENDING_TEMPLATES,
  MIN_TRENDING_TEMPLATES,
  selectTrendingEntries,
  sortGalleryEntries
} from "./galleryEntries";

import { buildCommunityTemplateCard, buildGalleryEntry } from "@tests/seeders/communityTemplate";

const GiB = 1024 ** 3;

describe("galleryEntries", () => {
  describe(buildGalleryEntries.name, () => {
    it("turns an awesome-akash template into an Official entry published by nobody else", () => {
      const hardware = { cpu: 2, memoryBytes: 4 * GiB, storageBytes: 8 * GiB };
      const [entry] = buildGalleryEntries({
        categories: [makeCategory("AI - GPU", [makeTemplate({ id: "llama", name: "Llama 3", summary: "Chat with a model", hardware })])],
        community: undefined
      });

      expect(entry).toEqual({
        key: "awesome-akash:llama",
        origin: "awesome-akash",
        id: "llama",
        title: "Llama 3",
        summary: "Chat with a model",
        icon: null,
        categories: ["AI - GPU"],
        isOfficial: true,
        isFeatured: false,
        publisher: null,
        resources: hardware,
        versionCount: null,
        publishedAt: null,
        usage: { deploys: 0, stillUpAfter24h: null, forks: 0 },
        scores: { popular: null, trending: null, isTrending: false },
        curatedRank: 2,
        searchText: "llama 3 chat with a model akash network"
      });
    });

    it("lists a template filed under several categories once, with every category", () => {
      const template = makeTemplate({ id: "llama" });
      const entries = buildGalleryEntries({
        categories: [makeCategory("AI - GPU", [template]), makeCategory("Chat", [template]), makeCategory("Tools", [makeTemplate({ id: "other" })])],
        community: undefined
      });

      expect(entries.map(entry => [entry.id, entry.categories])).toEqual([
        ["llama", ["AI - GPU", "Chat"]],
        ["other", ["Tools"]]
      ]);
    });

    it("gives an awesome-akash template the usage the API reports for its id", () => {
      const [used, unused] = buildGalleryEntries({
        categories: [makeCategory("AI - GPU", [makeTemplate({ id: "llama" }), makeTemplate({ id: "comfy" })])],
        community: makeCommunity({
          officialUsage: { llama: { deploys: 9, stillUpAfter24h: 0.8, forks: 0, scores: scoresOf({ popular: 4.5, trending: 2, isTrending: true }) } }
        })
      });

      expect(used.usage).toEqual({ deploys: 9, stillUpAfter24h: 0.8, forks: 0 });
      expect(used.scores).toEqual({ popular: 4.5, trending: 2, isTrending: true });
      expect(unused.usage).toEqual({ deploys: 0, stillUpAfter24h: null, forks: 0 });
    });

    it("reads the scores of an awesome-akash template once the API sends them with its usage", () => {
      const scores = { popular: 12.5, trending: 3, isTrending: true };
      const officialUsage = { llama: { deploys: 9, stillUpAfter24h: null, forks: 0, scores } };
      const [entry] = buildGalleryEntries({
        categories: [makeCategory("AI - GPU", [makeTemplate({ id: "llama" })])],
        community: makeCommunity({ officialUsage })
      });

      expect(entry.scores).toEqual(scores);
      expect(entry.usage).toEqual({ deploys: 9, stillUpAfter24h: null, forks: 0 });
    });

    it("does not mistake an object's built-in property for a template's usage", () => {
      const [entry] = buildGalleryEntries({
        categories: [makeCategory("Tools", [makeTemplate({ id: "constructor" })])],
        community: makeCommunity({})
      });

      expect(entry.usage).toEqual({ deploys: 0, stillUpAfter24h: null, forks: 0 });
    });

    it("keeps the gallery's own promotion order for awesome-akash templates", () => {
      const entries = buildGalleryEntries({
        categories: [
          makeCategory("Tools", [
            makeTemplate({ id: "plain" }),
            makeTemplate({ id: "liked", tags: ["popular"] }),
            makeTemplate({ id: "pick", tags: ["recommended"] })
          ])
        ],
        community: undefined
      });

      expect(entries.map(entry => entry.curatedRank)).toEqual([2, 1, 0]);
    });

    it("turns a community card into an entry that keeps its publisher and numbers", () => {
      const card = buildCommunityTemplateCard({
        id: "0b6f6f0c-6d0f-4b53-9d5c-0c7d2d6f0001",
        title: "Open WebUI + vLLM",
        summary: "Private chat",
        icon: "bot",
        categories: ["Chat"],
        publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: true },
        resources: { cpu: 8, memoryBytes: 48 * GiB, storageBytes: 40 * GiB, gpu: { units: 1, models: ["a100"] } },
        versionCount: 4,
        publishedAt: "2026-10-30T12:00:00.000Z",
        usage: { deploys: 1284, stillUpAfter24h: 0.94, forks: 37 },
        scores: { popular: 7, trending: 2, isTrending: true }
      });

      const [entry] = buildGalleryEntries({ categories: [], community: makeCommunity({ templates: [card] }) });

      expect(entry).toEqual({
        key: "console:0b6f6f0c-6d0f-4b53-9d5c-0c7d2d6f0001",
        origin: "console",
        id: card.id,
        title: "Open WebUI + vLLM",
        summary: "Private chat",
        icon: "bot",
        categories: ["Chat"],
        isOfficial: false,
        isFeatured: false,
        publisher: card.publisher,
        resources: card.resources,
        versionCount: 4,
        publishedAt: Date.UTC(2026, 9, 30, 12),
        usage: card.usage,
        scores: card.scores,
        curatedRank: 2,
        searchText: "open webui + vllm private chat lambda garage"
      });
    });

    it("ranks a community template staff featured ahead of the recommended awesome-akash ones", () => {
      const [entry] = buildGalleryEntries({
        categories: [],
        community: makeCommunity({ templates: [buildCommunityTemplateCard({ isFeatured: true, isOfficial: true })] })
      });

      expect(entry.curatedRank).toBe(-1);
      expect(entry.isFeatured).toBe(true);
      expect(entry.isOfficial).toBe(true);
    });

    it("leaves a missing summary out of the searchable text", () => {
      const [entry] = buildGalleryEntries({
        categories: [],
        community: makeCommunity({
          templates: [buildCommunityTemplateCard({ title: "Redis", summary: null, publisher: { name: "Ada", handle: "ada", verified: false } })]
        })
      });

      expect(entry.searchText).toBe("redis ada");
    });

    it("lists awesome-akash templates before community ones", () => {
      const entries = buildGalleryEntries({
        categories: [makeCategory("Tools", [makeTemplate({ id: "awesome" })])],
        community: makeCommunity({ templates: [buildCommunityTemplateCard({ title: "Community" })] })
      });

      expect(entries.map(entry => entry.origin)).toEqual(["awesome-akash", "console"]);
    });
  });

  describe(listGalleryCategories.name, () => {
    it("keeps the awesome-akash order and adds categories only community templates use, alphabetically and once", () => {
      const entries = [
        buildGalleryEntry({ categories: ["Wallet", "Chat"] }),
        buildGalleryEntry({ categories: ["Benchmarking", "Wallet"] }),
        buildGalleryEntry({ categories: ["Tools"] })
      ];

      expect(listGalleryCategories([makeCategory("Tools", []), makeCategory("Chat", [])], entries)).toEqual(["Tools", "Chat", "Benchmarking", "Wallet"]);
    });
  });

  describe(listGalleryUseCaseFilters.name, () => {
    it("counts every entry once under All and under each of its categories", () => {
      const entries = [
        buildGalleryEntry({ categories: ["Chat", "Tools"], isOfficial: true }),
        buildGalleryEntry({ categories: ["Chat"] }),
        buildGalleryEntry({ categories: [] })
      ];

      expect(listGalleryUseCaseFilters({ entries, categories: ["Chat", "Tools", "Games"], source: "all" })).toEqual([
        { category: null, label: "All", count: 3 },
        { category: "Chat", label: "Chat", count: 2 },
        { category: "Tools", label: "Tools", count: 1 },
        { category: "Games", label: "Games", count: 0 }
      ]);
    });

    it("counts only the selected source", () => {
      const entries = [
        buildGalleryEntry({ categories: ["Chat"], isOfficial: true }),
        buildGalleryEntry({ categories: ["Chat"] }),
        buildGalleryEntry({ categories: ["Chat"] })
      ];

      expect(listGalleryUseCaseFilters({ entries, categories: ["Chat"], source: "official" }).map(filter => filter.count)).toEqual([1, 1]);
      expect(listGalleryUseCaseFilters({ entries, categories: ["Chat"], source: "community" }).map(filter => filter.count)).toEqual([2, 2]);
    });
  });

  describe(countGallerySources.name, () => {
    it("splits the gallery into Official and Community", () => {
      const entries = [buildGalleryEntry({ isOfficial: true }), buildGalleryEntry({ isOfficial: true }), buildGalleryEntry({ isOfficial: false })];

      expect(countGallerySources(entries, null)).toEqual({ all: 3, official: 2, community: 1 });
    });

    it("counts only the selected category", () => {
      const entries = [
        buildGalleryEntry({ isOfficial: true, categories: ["Chat"] }),
        buildGalleryEntry({ isOfficial: false, categories: ["Chat", "Tools"] }),
        buildGalleryEntry({ isOfficial: false, categories: ["Tools"] })
      ];

      expect(countGallerySources(entries, "Chat")).toEqual({ all: 2, official: 1, community: 1 });
    });
  });

  describe(filterGalleryEntries.name, () => {
    const official = buildGalleryEntry({ title: "Official", isOfficial: true, categories: ["Chat"], searchText: "llama chat akash network" });
    const community = buildGalleryEntry({ title: "Community", isOfficial: false, categories: ["Tools"], searchText: "llama tools lambda garage" });

    it("keeps everything for All with no category and no search", () => {
      expect(titlesOf(filterGalleryEntries([official, community], { source: "all", category: null, search: "" }))).toEqual(["Official", "Community"]);
    });

    it("keeps only Official templates for the Official source", () => {
      expect(titlesOf(filterGalleryEntries([official, community], { source: "official", category: null, search: "" }))).toEqual(["Official"]);
    });

    it("keeps only templates Akash has not promoted for the Community source", () => {
      expect(titlesOf(filterGalleryEntries([official, community], { source: "community", category: null, search: "" }))).toEqual(["Community"]);
    });

    it("keeps only the selected category", () => {
      expect(titlesOf(filterGalleryEntries([official, community], { source: "all", category: "Tools", search: "" }))).toEqual(["Community"]);
    });

    it("matches every search term in any order and any case, across title, summary and publisher", () => {
      expect(titlesOf(filterGalleryEntries([official, community], { source: "all", category: null, search: "  GARAGE llama " }))).toEqual(["Community"]);
      expect(titlesOf(filterGalleryEntries([official, community], { source: "all", category: null, search: "llama" }))).toEqual(["Official", "Community"]);
      expect(titlesOf(filterGalleryEntries([official, community], { source: "all", category: null, search: "llama minecraft" }))).toEqual([]);
    });

    it("applies the source, the category and the search together", () => {
      expect(titlesOf(filterGalleryEntries([official, community], { source: "official", category: "Tools", search: "llama" }))).toEqual([]);
      expect(titlesOf(filterGalleryEntries([official, community], { source: "community", category: "Tools", search: "llama" }))).toEqual(["Community"]);
    });
  });

  describe(sortGalleryEntries.name, () => {
    it("sorts Popular by deploys while no score exists, both sources together", () => {
      const entries = [
        buildGalleryEntry({ title: "Community 5", usage: usageOf(5) }),
        buildGalleryEntry({ title: "Official 9", isOfficial: true, origin: "awesome-akash", usage: usageOf(9) }),
        buildGalleryEntry({ title: "Community 7", usage: usageOf(7) })
      ];

      expect(titlesOf(sortGalleryEntries(entries, "popular"))).toEqual(["Official 9", "Community 7", "Community 5"]);
    });

    it("sorts Popular by the popular score once it exists, whatever the deploys", () => {
      const entries = [
        buildGalleryEntry({ title: "Many deploys", usage: usageOf(100), scores: scoresOf({ popular: 1 }) }),
        buildGalleryEntry({ title: "High score", usage: usageOf(2), scores: scoresOf({ popular: 8 }) })
      ];

      expect(titlesOf(sortGalleryEntries(entries, "popular"))).toEqual(["High score", "Many deploys"]);
    });

    it("sorts Trending by the trending score, falling back to deploys while it is null", () => {
      const scored = [
        buildGalleryEntry({ title: "Slow", usage: usageOf(100), scores: scoresOf({ trending: 1 }) }),
        buildGalleryEntry({ title: "Rising", usage: usageOf(2), scores: scoresOf({ trending: 8 }) })
      ];
      const unscored = [buildGalleryEntry({ title: "Few", usage: usageOf(2) }), buildGalleryEntry({ title: "Many", usage: usageOf(100) })];

      expect(titlesOf(sortGalleryEntries(scored, "trending"))).toEqual(["Rising", "Slow"]);
      expect(titlesOf(sortGalleryEntries(unscored, "trending"))).toEqual(["Many", "Few"]);
    });

    it("sorts Newest by publish date, with undated awesome-akash templates after every dated one, most popular first", () => {
      const entries = [
        buildGalleryEntry({ title: "Awesome quiet", publishedAt: null, usage: usageOf(1) }),
        buildGalleryEntry({ title: "Older", publishedAt: Date.UTC(2026, 0, 1), usage: usageOf(50) }),
        buildGalleryEntry({ title: "Awesome busy", publishedAt: null, usage: usageOf(40) }),
        buildGalleryEntry({ title: "Newer", publishedAt: Date.UTC(2026, 5, 1), usage: usageOf(0) })
      ];

      expect(titlesOf(sortGalleryEntries(entries, "newest"))).toEqual(["Newer", "Older", "Awesome busy", "Awesome quiet"]);
    });

    it("breaks a tie by the gallery's promotion order, then by title", () => {
      const entries = [
        buildGalleryEntry({ title: "Zeta", curatedRank: 2 }),
        buildGalleryEntry({ title: "Alpha", curatedRank: 2 }),
        buildGalleryEntry({ title: "Recommended", curatedRank: 0 }),
        buildGalleryEntry({ title: "Featured", curatedRank: -1 })
      ];

      expect(titlesOf(sortGalleryEntries(entries, "popular"))).toEqual(["Featured", "Recommended", "Alpha", "Zeta"]);
    });

    it("breaks a tie between equal trending scores by popularity", () => {
      const entries = [
        buildGalleryEntry({ title: "Less popular", scores: scoresOf({ trending: 3, popular: 1 }) }),
        buildGalleryEntry({ title: "More popular", scores: scoresOf({ trending: 3, popular: 4 }) })
      ];

      expect(titlesOf(sortGalleryEntries(entries, "trending"))).toEqual(["More popular", "Less popular"]);
    });

    it("leaves the list it was given untouched", () => {
      const entries = [buildGalleryEntry({ title: "Few", usage: usageOf(1) }), buildGalleryEntry({ title: "Many", usage: usageOf(9) })];

      sortGalleryEntries(entries, "popular");

      expect(titlesOf(entries)).toEqual(["Few", "Many"]);
    });
  });

  describe(selectTrendingEntries.name, () => {
    it("is empty while fewer templates than the minimum are trending", () => {
      const entries = [...makeTrending(MIN_TRENDING_TEMPLATES - 1), buildGalleryEntry({ title: "Not trending", scores: scoresOf({ trending: 99 }) })];

      expect(selectTrendingEntries(entries, MIN_TRENDING_TEMPLATES)).toEqual([]);
    });

    it("shows the trending templates once the minimum is met, strongest first", () => {
      const entries = makeTrending(MIN_TRENDING_TEMPLATES);

      expect(titlesOf(selectTrendingEntries(entries, MIN_TRENDING_TEMPLATES))).toEqual(["Trending 3", "Trending 2", "Trending 1"]);
    });

    it("takes the minimum it is given, so the API decides how full the row must be", () => {
      const entries = makeTrending(MIN_TRENDING_TEMPLATES);

      expect(selectTrendingEntries(entries, MIN_TRENDING_TEMPLATES + 1)).toEqual([]);
      expect(selectTrendingEntries(entries, 1)).toHaveLength(MIN_TRENDING_TEMPLATES);
    });

    it("stops at the length of the row", () => {
      const trending = selectTrendingEntries(makeTrending(MAX_TRENDING_TEMPLATES + 2), MIN_TRENDING_TEMPLATES);

      expect(trending).toHaveLength(MAX_TRENDING_TEMPLATES);
      expect(trending[0].title).toBe(`Trending ${MAX_TRENDING_TEMPLATES + 2}`);
    });

    it("is empty with the placeholder scores the API sends before scores are computed", () => {
      expect(selectTrendingEntries([buildGalleryEntry(), buildGalleryEntry(), buildGalleryEntry(), buildGalleryEntry()], 1)).toEqual([]);
    });
  });

  it("pages the gallery by two dozen cards and needs three trending templates for the row", () => {
    expect(GALLERY_PAGE_SIZE).toBe(24);
    expect(MIN_TRENDING_TEMPLATES).toBe(3);
    expect(MAX_TRENDING_TEMPLATES).toBe(4);
  });

  function titlesOf(entries: GalleryEntry[]) {
    return entries.map(entry => entry.title);
  }

  function usageOf(deploys: number) {
    return { deploys, stillUpAfter24h: null, forks: 0 };
  }

  function scoresOf(scores: { popular?: number; trending?: number; isTrending?: boolean }) {
    return { popular: scores.popular ?? null, trending: scores.trending ?? null, isTrending: scores.isTrending ?? false };
  }

  function makeTrending(count: number) {
    return Array.from({ length: count }, (_, index) =>
      buildGalleryEntry({ title: `Trending ${index + 1}`, scores: scoresOf({ trending: index + 1, isTrending: true }) })
    );
  }

  function makeTemplate(overrides: Partial<TemplateOutputSummaryWithCategory> = {}): TemplateOutputSummaryWithCategory {
    return { id: "template", name: "Template", summary: "", deploy: "", category: "", ...overrides };
  }

  function makeCategory(title: string, templates: TemplateOutputSummaryWithCategory[]): EnhancedTemplateCategory {
    return { title, templates };
  }

  function makeCommunity(overrides: Partial<CommunityTemplateGallery>): CommunityTemplateGallery {
    return { templates: [], officialUsage: {}, trendingRowMinTemplates: MIN_TRENDING_TEMPLATES, ...overrides };
  }
});
