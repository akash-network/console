import { describe, expect, it } from "vitest";

import { buildPublisherSeo, buildTemplateSeo } from "./marketplaceSeo";

import { buildTemplatePublisherPage } from "@tests/seeders/templatePublisher";
import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";

const TEMPLATE_ID = "5f0c7f0e-6a51-4a53-9a50-0c1f3f1d2b11";
const TEMPLATE_URL = `https://console.akash.network/template/${TEMPLATE_ID}`;
const TEMPLATE_IMAGE_URL = `https://console.akash.network/api/og/template/${TEMPLATE_ID}`;
const LISTED = { visibility: "public", isListed: true, publishedAt: "2026-10-01T00:00:00.000Z", moderationStatus: "active" } as const;

describe(buildTemplateSeo.name, () => {
  it("describes a listed template with its title, summary, own address and preview image, for search engines and link previews alike", () => {
    const template = buildMarketplaceTemplate({ ...LISTED, id: TEMPLATE_ID, title: "Llama chat server", summary: "An OpenAI-compatible endpoint." });

    expect(buildTemplateSeo(template)).toEqual({
      title: "Llama chat server",
      description: "An OpenAI-compatible endpoint.",
      canonical: TEMPLATE_URL,
      noindex: false,
      openGraph: {
        type: "website",
        url: TEMPLATE_URL,
        title: "Llama chat server",
        description: "An OpenAI-compatible endpoint.",
        images: [{ url: TEMPLATE_IMAGE_URL, width: 1200, height: 630, alt: "Llama chat server on Akash Console", type: "image/png" }]
      },
      twitter: { cardType: "summary_large_image" },
      additionalMetaTags: [
        { name: "twitter:title", content: "Llama chat server" },
        { name: "twitter:description", content: "An OpenAI-compatible endpoint." },
        { name: "twitter:image", content: TEMPLATE_IMAGE_URL }
      ]
    });
  });

  it.each([
    ["is public but out of the gallery", { isListed: false }],
    ["is public but never listed", { publishedAt: null }],
    ["is private", { visibility: "private" }],
    ["is shared with its organization only", { visibility: "organization" }],
    ["is hidden by staff", { moderationStatus: "hidden" }]
  ] as const)("keeps a template that %s out of search engines and gives it no preview image", (_, change) => {
    const seo = buildTemplateSeo(buildMarketplaceTemplate({ ...LISTED, ...change, id: TEMPLATE_ID, title: "Llama chat server" }));

    expect(seo.noindex).toBe(true);
    expect(seo.openGraph?.images).toBeUndefined();
    expect(seo.additionalMetaTags).toEqual([
      { name: "twitter:title", content: "Llama chat server" },
      { name: "twitter:description", content: "A template you can deploy on Akash Network from Akash Console." }
    ]);
    expect(seo.canonical).toBe(TEMPLATE_URL);
  });

  it("keeps the view of someone who can edit the template out of search engines, with the preview image a visitor gets", () => {
    const seo = buildTemplateSeo(buildMarketplaceTemplate({ ...LISTED, id: TEMPLATE_ID, canEdit: true }));

    expect(seo.noindex).toBe(true);
    expect(seo.openGraph?.images?.[0].url).toBe(TEMPLATE_IMAGE_URL);
  });

  it("describes a template without a summary generically", () => {
    const seo = buildTemplateSeo(buildMarketplaceTemplate({ ...LISTED, summary: null }));

    expect(seo.description).toBe("A template you can deploy on Akash Network from Akash Console.");
    expect(seo.openGraph?.description).toBe("A template you can deploy on Akash Network from Akash Console.");
  });

  it("describes a template whose summary is only spaces generically", () => {
    expect(buildTemplateSeo(buildMarketplaceTemplate({ ...LISTED, summary: " \n " })).description).toBe(
      "A template you can deploy on Akash Network from Akash Console."
    );
  });

  it("puts a summary written over several lines on one", () => {
    expect(buildTemplateSeo(buildMarketplaceTemplate({ summary: "  First line.\n\nSecond\tline.  " })).description).toBe("First line. Second line.");
  });

  it("leaves a summary of 200 characters whole and cuts a longer one to 200 with an ellipsis", () => {
    expect(buildTemplateSeo(buildMarketplaceTemplate({ summary: "s".repeat(200) })).description).toBe("s".repeat(200));
    expect(buildTemplateSeo(buildMarketplaceTemplate({ summary: `${"s".repeat(198)} tail` })).description).toBe(`${"s".repeat(198)}…`);
  });

  it("hands markup in a title and summary on as plain text for the head tags to escape", () => {
    const seo = buildTemplateSeo(
      buildMarketplaceTemplate({ ...LISTED, title: '"><script>alert(1)</script>', summary: "</title><img src=x onerror=alert(2)>" })
    );

    expect(seo.title).toBe('"><script>alert(1)</script>');
    expect(seo.description).toBe("</title><img src=x onerror=alert(2)>");
    expect(seo.openGraph?.images?.[0].alt).toBe('"><script>alert(1)</script> on Akash Console');
  });
});

describe(buildPublisherSeo.name, () => {
  const PUBLISHER_URL = "https://console.akash.network/template-publishers/northwind";
  const PUBLISHER_IMAGE_URL = "https://console.akash.network/api/og/template-publisher/northwind";

  it("describes a publisher with its name, bio, own address and preview image", () => {
    const publisher = buildTemplatePublisherPage({
      handle: "northwind",
      name: "Northwind Labs",
      bio: "We publish inference templates.",
      counts: { templates: 3, deploys: 40 }
    });

    expect(buildPublisherSeo(publisher, { isOwnProfile: false })).toEqual({
      title: "Northwind Labs · Templates",
      description: "We publish inference templates.",
      canonical: PUBLISHER_URL,
      noindex: false,
      openGraph: {
        type: "website",
        url: PUBLISHER_URL,
        title: "Northwind Labs · Templates",
        description: "We publish inference templates.",
        images: [{ url: PUBLISHER_IMAGE_URL, width: 1200, height: 630, alt: "Northwind Labs on Akash Console", type: "image/png" }]
      },
      twitter: { cardType: "summary_large_image" },
      additionalMetaTags: [
        { name: "twitter:title", content: "Northwind Labs · Templates" },
        { name: "twitter:description", content: "We publish inference templates." },
        { name: "twitter:image", content: PUBLISHER_IMAGE_URL }
      ]
    });
  });

  it("describes a publisher without a bio by what the page lists", () => {
    const publisher = buildTemplatePublisherPage({ name: "Northwind Labs", bio: null, counts: { templates: 3, deploys: 40 } });

    expect(buildPublisherSeo(publisher, { isOwnProfile: false }).description).toBe("Templates published by Northwind Labs on Akash Console.");
  });

  it("keeps a publisher that lists no template out of search engines", () => {
    const publisher = buildTemplatePublisherPage({ counts: { templates: 0, deploys: 0 } });

    expect(buildPublisherSeo(publisher, { isOwnProfile: false }).noindex).toBe(true);
  });

  it("lets a publisher that lists one template be indexed", () => {
    const publisher = buildTemplatePublisherPage({ counts: { templates: 1, deploys: 0 } });

    expect(buildPublisherSeo(publisher, { isOwnProfile: false }).noindex).toBe(false);
  });

  it("keeps the view of the publisher's own member out of search engines", () => {
    const publisher = buildTemplatePublisherPage({ counts: { templates: 3, deploys: 40 } });

    expect(buildPublisherSeo(publisher, { isOwnProfile: true }).noindex).toBe(true);
  });
});
