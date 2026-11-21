import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { loadTemplateDetailRouteProps } from "./loadTemplateDetailRouteProps";

import { buildMarketplaceRouteContext, VISITOR_TOGGLES } from "@tests/unit/marketplaceRouteContext";

const TEMPLATE_ID = "akash-network-awesome-akash-llama";
const URL = `https://console.akash.network/templates/${TEMPLATE_ID}`;

describe(loadTemplateDetailRouteProps.name, () => {
  it.each(["on", "off"] as const)("serves a member the template with its link preview, with the marketplace %s", async flag => {
    const { context, template } = buildMarketplaceRouteContext({ session: "valid", flag });
    const llama = mock<TemplateOutput>({ id: TEMPLATE_ID, name: "Llama chat", summary: "Chat with an open model.", logoUrl: "https://example.com/llama.png" });
    template.findById.mockResolvedValue(llama);

    expect(await loadTemplateDetailRouteProps(TEMPLATE_ID, context)).toEqual({
      props: {
        template: llama,
        seo: {
          title: "Template detail Llama chat",
          description: "Chat with an open model.",
          canonical: URL,
          openGraph: {
            title: "Template detail Llama chat",
            description: "Chat with an open model.",
            url: URL,
            images: [{ url: "https://example.com/llama.png", width: 1200, height: 630, alt: "Template image" }]
          }
        }
      }
    });
    expect(template.findById).toHaveBeenCalledWith(TEMPLATE_ID);
  });

  it("serves a visitor the same page, marked as rendered for a visitor", async () => {
    const { context, template } = buildMarketplaceRouteContext({ session: "none", flag: "on" });
    const llama = mock<TemplateOutput>({ id: TEMPLATE_ID, name: "Llama chat", summary: "", logoUrl: "" });
    template.findById.mockResolvedValue(llama);

    expect(await loadTemplateDetailRouteProps(TEMPLATE_ID, context)).toEqual({
      props: {
        template: llama,
        visitorAccess: { featureToggles: VISITOR_TOGGLES },
        seo: {
          title: "Template detail Llama chat",
          description: "",
          canonical: URL,
          openGraph: { title: "Template detail Llama chat", description: "", url: URL }
        }
      }
    });
  });

  it("shortens a long summary in the description", async () => {
    const { context, template } = buildMarketplaceRouteContext({ session: "valid", flag: "on" });
    template.findById.mockResolvedValue(mock<TemplateOutput>({ id: TEMPLATE_ID, name: "Llama chat", summary: "a".repeat(200), logoUrl: "" }));

    const result = (await loadTemplateDetailRouteProps(TEMPLATE_ID, context)) as { props: { seo: { description: string } } };

    expect(result.props.seo.description).toBe(`${"a".repeat(137)}...`);
  });

  it("sends a visitor to sign in and back to the template while the marketplace is off for visitors", async () => {
    const { context, template } = buildMarketplaceRouteContext({ session: "none", flag: "off", resolvedUrl: `/templates/${TEMPLATE_ID}` });

    expect(await loadTemplateDetailRouteProps(TEMPLATE_ID, context)).toEqual({
      redirect: { destination: `/login?tab=login&returnTo=%2Ftemplates%2F${TEMPLATE_ID}`, permanent: false }
    });
    expect(template.findById).not.toHaveBeenCalled();
  });

  it("answers not found for a template the list does not have", async () => {
    const { context, template } = buildMarketplaceRouteContext({ session: "valid", flag: "on" });
    template.findById.mockResolvedValue(undefined as never);

    expect(await loadTemplateDetailRouteProps("unknown", context)).toEqual({ notFound: true });
  });
});
