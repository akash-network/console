import { hydrate, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ITemplate } from "@src/types";
import { loadTemplateRouteProps } from "./loadTemplateRouteProps";
import type { TemplateRouteProps } from "./TemplateRoute";

import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";
import { buildMarketplaceRouteContext, VISITOR_TOGGLES } from "@tests/unit/marketplaceRouteContext";

const TEMPLATE_ID = "0b6bbd9c-5a3e-4d0a-9d0c-6f1a2b3c4d5e";
const API_URL = "https://console-api.akash.network";
const VISITOR_ACCESS = { featureToggles: VISITOR_TOGGLES };

describe(loadTemplateRouteProps.name, () => {
  describe("for a member", () => {
    it("serves the template page and reads nothing when the marketplace is on", async () => {
      const { context, consoleApiHttpClient, marketplaceVisitorReads, logger } = buildMarketplaceRouteContext({ session: "valid", flag: "on" });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({ props: { id: TEMPLATE_ID, isMarketplace: true } });
      expect(consoleApiHttpClient.get).not.toHaveBeenCalled();
      expect(marketplaceVisitorReads.template).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each(["off", "failing"] as const)("serves the legacy page, read with the member's token, while the flag is %s", async flag => {
      const { context, consoleApiHttpClient } = buildMarketplaceRouteContext({ session: "valid", flag });
      const legacyTemplate = mock<ITemplate>({ id: TEMPLATE_ID, title: "Open WebUI + vLLM" });
      consoleApiHttpClient.get.mockResolvedValue({ data: legacyTemplate });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({ props: { id: TEMPLATE_ID, template: legacyTemplate } });
      expect(consoleApiHttpClient.get).toHaveBeenCalledWith(`${API_URL}/v1/user/template/${TEMPLATE_ID}`, { headers: { Authorization: "Bearer token-1" } });
    });
  });

  describe("for a visitor", () => {
    it("sends them to sign in and back to the template while the marketplace is off for visitors", async () => {
      const { context, marketplaceVisitorReads, consoleApiHttpClient } = buildMarketplaceRouteContext({
        session: "none",
        flag: "off",
        resolvedUrl: `/template/${TEMPLATE_ID}`
      });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({
        redirect: { destination: `/login?tab=login&returnTo=%2Ftemplate%2F${TEMPLATE_ID}`, permanent: false }
      });
      expect(marketplaceVisitorReads.template).not.toHaveBeenCalled();
      expect(consoleApiHttpClient.get).not.toHaveBeenCalled();
    });

    it("serves the page with the template already read, under the key the page asks for it", async () => {
      const { context, marketplaceVisitorReads, res } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      const answer = { data: buildMarketplaceTemplate({ id: TEMPLATE_ID, visibility: "public", title: "Open WebUI" }) };
      marketplaceVisitorReads.template.mockResolvedValue({ status: "found", data: answer });

      const props = await loadVisitorProps(context);

      expect(props).toEqual({ id: TEMPLATE_ID, isMarketplace: true, visitorAccess: VISITOR_ACCESS, dehydratedState: expect.anything() });
      expect(marketplaceVisitorReads.template).toHaveBeenCalledWith(TEMPLATE_ID);
      expect(readHydrated(props, context.services.visitorApiQueries.v1.getUserTemplate.getKey({ id: TEMPLATE_ID }))).toEqual(
        JSON.parse(JSON.stringify(answer))
      );
      expect(res.statusCode).toBe(200);
    });

    it("answers not found for a private, hidden or unknown template", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      marketplaceVisitorReads.template.mockResolvedValue({ status: "missing" });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({ notFound: true });
    });

    it("answers 410 with the removed page for a removed template", async () => {
      const { context, marketplaceVisitorReads, res } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      marketplaceVisitorReads.template.mockResolvedValue({ status: "removed", title: "Open WebUI" });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({
        props: { id: TEMPLATE_ID, isMarketplace: true, visitorAccess: VISITOR_ACCESS, removedTemplate: { title: "Open WebUI" } }
      });
      expect(res.statusCode).toBe(410);
    });

    it("sends a removed template whose title is gone as a title Next can serialize", async () => {
      const { context, marketplaceVisitorReads } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      marketplaceVisitorReads.template.mockResolvedValue({ status: "removed", title: undefined });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({
        props: { id: TEMPLATE_ID, isMarketplace: true, visitorAccess: VISITOR_ACCESS, removedTemplate: { title: null } }
      });
    });

    it("serves the page without the template when the API is slow or down, for the browser to load it", async () => {
      const { context, marketplaceVisitorReads, res } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
      marketplaceVisitorReads.template.mockResolvedValue({ status: "unavailable" });

      expect(await loadTemplateRouteProps(TEMPLATE_ID, context)).toEqual({ props: { id: TEMPLATE_ID, isMarketplace: true, visitorAccess: VISITOR_ACCESS } });
      expect(res.statusCode).toBe(200);
    });
  });

  async function loadVisitorProps(context: Parameters<typeof loadTemplateRouteProps>[1]) {
    const result = (await loadTemplateRouteProps(TEMPLATE_ID, context)) as { props: Extract<TemplateRouteProps, { isMarketplace: true }> };
    return result.props;
  }

  function readHydrated(props: Extract<TemplateRouteProps, { isMarketplace: true }>, queryKey: readonly unknown[]) {
    const queryClient = new QueryClient();
    hydrate(queryClient, props.dehydratedState);
    return queryClient.getQueryData(queryKey);
  }
});
