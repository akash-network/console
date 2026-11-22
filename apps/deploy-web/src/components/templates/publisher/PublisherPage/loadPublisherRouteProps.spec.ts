import { hydrate, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { PublisherRouteProps } from "./loadPublisherRouteProps";
import { loadPublisherRouteProps, selectPublisherFirstPage } from "./loadPublisherRouteProps";

import { buildCommunityTemplateCard } from "@tests/seeders/communityTemplate";
import { buildTemplatePublisherPage } from "@tests/seeders/templatePublisher";
import { buildMarketplaceRouteContext, VISITOR_TOGGLES } from "@tests/unit/marketplaceRouteContext";

const VISITOR_ACCESS = { featureToggles: VISITOR_TOGGLES };

describe(loadPublisherRouteProps.name, () => {
  describe("for a member", () => {
    it("serves the page and reads nothing when the marketplace is on", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "valid", flag: "on" });

      expect(await loadPublisherRouteProps("acme-labs", context)).toEqual({ props: { handle: "acme-labs" } });
      expect(marketplaceVisitorReads.publisher).not.toHaveBeenCalled();
    });

    it("answers not found while the marketplace is off", async () => {
      const { context } = buildMarketplaceRouteContext({ session: "valid", flag: "off" });

      expect(await loadPublisherRouteProps("acme-labs", context)).toEqual({ notFound: true });
    });
  });

  describe("for a visitor", () => {
    it("sends them to sign in and back to the page while the marketplace is off for visitors", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({
        session: "none",
        flag: "off",
        resolvedUrl: "/template-publishers/acme-labs"
      });

      expect(await loadPublisherRouteProps("acme-labs", context)).toEqual({
        redirect: { destination: "/login?tab=login&returnTo=%2Ftemplate-publishers%2Facme-labs", permanent: false }
      });
      expect(marketplaceVisitorReads.publisher).not.toHaveBeenCalled();
    });

    it("serves the page with the publisher already read, whole and fresh when it fits one screen", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      const answer = { data: buildTemplatePublisherPage({ handle: "acme-labs", templates: cards(24) }) };
      marketplaceVisitorReads.publisher.mockResolvedValue({ status: "found", data: answer });

      const props = await loadVisitorProps(context);
      const query = hydratedQuery(props, context.services.visitorApiQueries.v1.getTemplatePublisher.getKey({ handle: "acme-labs" }));

      expect(props).toEqual({ handle: "acme-labs", visitorAccess: VISITOR_ACCESS, dehydratedState: expect.anything() });
      expect(marketplaceVisitorReads.publisher).toHaveBeenCalledWith("acme-labs");
      expect(query?.state.data).toEqual(answer);
      expect(query?.isStaleByTime(60_000)).toBe(false);
    });

    it("serves the first screen of the view in the link, and has the browser load the rest, when the publisher lists more", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on", query: { sort: "newest", search: "tool" } });
      const templates = [...cards(30, "Tool"), buildCommunityTemplateCard({ title: "Unrelated", publishedAt: "2030-01-01T00:00:00.000Z" })];
      marketplaceVisitorReads.publisher.mockResolvedValue({ status: "found", data: { data: buildTemplatePublisherPage({ handle: "acme-labs", templates }) } });

      const props = await loadVisitorProps(context);
      const query = hydratedQuery(props, context.services.visitorApiQueries.v1.getTemplatePublisher.getKey({ handle: "acme-labs" }));
      const shown = (query?.state.data as { data: { templates: { title: string }[] } }).data.templates.map(template => template.title);

      expect(shown).toEqual(Array.from({ length: 24 }, (_, index) => `Tool ${String(29 - index).padStart(2, "0")}`).reverse());
      expect(query?.isStaleByTime(60_000)).toBe(true);
    });

    it.each(["missing", "removed"] as const)("answers not found when the publisher read answers %s", async status => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      marketplaceVisitorReads.publisher.mockResolvedValue(status === "removed" ? { status, title: undefined } : { status });

      expect(await loadPublisherRouteProps("nobody", context)).toEqual({ notFound: true });
    });

    it("serves the page without the publisher when the API is slow or down, for the browser to load it", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      marketplaceVisitorReads.publisher.mockResolvedValue({ status: "unavailable" });

      expect(await loadPublisherRouteProps("acme-labs", context)).toEqual({ props: { handle: "acme-labs", visitorAccess: VISITOR_ACCESS } });
    });
  });

  describe(selectPublisherFirstPage.name, () => {
    it("keeps the 24 most popular cards by default, in the order the API listed them", () => {
      const templates = Array.from({ length: 26 }, (_, index) =>
        buildCommunityTemplateCard({ title: `Card ${index}`, usage: { deploys: index, stillUpAfter24h: null, forks: 0 } })
      );
      const answer = { data: buildTemplatePublisherPage({ templates }) };

      const firstPage = selectPublisherFirstPage(answer, { sort: "popular", search: "" });

      expect(firstPage.data.templates.map(template => template.title)).toEqual(templates.slice(2).map(template => template.title));
      expect(firstPage.data.counts).toEqual(answer.data.counts);
      expect(firstPage.data.name).toBe(answer.data.name);
    });

    it("answers the very same response when there is nothing to leave out", () => {
      const answer = { data: buildTemplatePublisherPage({ templates: cards(24) }) };

      expect(selectPublisherFirstPage(answer, { sort: "popular", search: "" })).toBe(answer);
    });
  });

  function cards(count: number, name = "Card") {
    return Array.from({ length: count }, (_, index) =>
      buildCommunityTemplateCard({ title: `${name} ${String(index).padStart(2, "0")}`, publishedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString() })
    );
  }

  async function loadVisitorProps(context: Parameters<typeof loadPublisherRouteProps>[1]) {
    const result = (await loadPublisherRouteProps("acme-labs", context)) as { props: PublisherRouteProps };
    return result.props;
  }

  function hydratedQuery(props: PublisherRouteProps, queryKey: readonly unknown[]) {
    const queryClient = new QueryClient();
    hydrate(queryClient, props.dehydratedState);
    return queryClient.getQueryCache().find({ queryKey });
  }
});
