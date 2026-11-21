import { describe, expect, it } from "vitest";

import type { TemplateGalleryRouteProps } from "./loadTemplateGalleryRouteProps";
import { loadTemplateGalleryRouteProps } from "./loadTemplateGalleryRouteProps";

import { buildCommunityTemplateCard } from "@tests/seeders/communityTemplate";
import { buildMarketplaceRouteContext, VISITOR_TOGGLES } from "@tests/unit/marketplaceRouteContext";

const VISITOR_ACCESS = { featureToggles: VISITOR_TOGGLES };

describe(loadTemplateGalleryRouteProps.name, () => {
  it.each(["on", "off"] as const)("serves a member the gallery as before and reads nothing, with the marketplace %s", async flag => {
    const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "valid", flag });

    expect(await loadTemplateGalleryRouteProps(context)).toEqual({ props: {} });
    expect(marketplaceVisitorReads.communityGallery).not.toHaveBeenCalled();
    expect(marketplaceVisitorReads.awesomeAkashCategories).not.toHaveBeenCalled();
  });

  it("sends a visitor to sign in and back to the gallery while the marketplace is off for visitors", async () => {
    const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "off", resolvedUrl: "/templates?category=Tools" });

    expect(await loadTemplateGalleryRouteProps(context)).toEqual({
      redirect: { destination: "/login?tab=login&returnTo=%2Ftemplates%3Fcategory%3DTools", permanent: false }
    });
    expect(marketplaceVisitorReads.communityGallery).not.toHaveBeenCalled();
  });

  it("serves a visitor the first screen of the view in the link, from both lists", async () => {
    const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on", query: { source: "community", sort: "newest" } });
    seedLists(marketplaceVisitorReads, { communityCount: 26 });

    const { visitorAccess, firstPage } = await loadVisitorProps(context);

    expect(visitorAccess).toEqual(VISITOR_ACCESS);
    expect(firstPage?.view).toEqual({ category: null, search: "", source: "community", sort: "newest" });
    expect(firstPage?.shownEntries).toHaveLength(24);
    expect(firstPage?.shownEntries[0].title).toBe("Community 25");
    expect(firstPage?.sourceCounts).toEqual({ all: 27, official: 1, community: 26 });
    expect(firstPage?.filters.map(filter => filter.label)).toEqual(["All", "Tools"]);
    expect(JSON.parse(JSON.stringify(firstPage))).toEqual(firstPage);
  });

  it.each(["community", "awesome-akash"] as const)(
    "serves the page without a first screen when the %s list is slow or down, for the browser to load both",
    async failing => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      seedLists(marketplaceVisitorReads, { communityCount: 1 });
      if (failing === "community") marketplaceVisitorReads.communityGallery.mockResolvedValue({ status: "unavailable" });
      else marketplaceVisitorReads.awesomeAkashCategories.mockResolvedValue({ status: "unavailable" });

      expect(await loadTemplateGalleryRouteProps(context)).toEqual({ props: { visitorAccess: VISITOR_ACCESS } });
    }
  );

  function seedLists(reads: ReturnType<typeof buildMarketplaceRouteContext>["marketplaceVisitorReads"], input: { communityCount: number }) {
    reads.awesomeAkashCategories.mockResolvedValue({
      status: "found",
      data: [
        { title: "Tools", templates: [{ id: "grafana", name: "Grafana", summary: "Dashboards", deploy: "", hardware: undefined }] },
        { title: "Empty", templates: [] }
      ]
    });
    reads.communityGallery.mockResolvedValue({
      status: "found",
      data: {
        data: {
          templates: Array.from({ length: input.communityCount }, (_, index) =>
            buildCommunityTemplateCard({
              title: `Community ${String(index).padStart(2, "0")}`,
              publishedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString()
            })
          ),
          officialUsage: {},
          trendingRowMinTemplates: 3
        }
      }
    });
  }

  async function loadVisitorProps(context: Parameters<typeof loadTemplateGalleryRouteProps>[0]) {
    const result = (await loadTemplateGalleryRouteProps(context)) as { props: TemplateGalleryRouteProps };
    return result.props;
  }
});
