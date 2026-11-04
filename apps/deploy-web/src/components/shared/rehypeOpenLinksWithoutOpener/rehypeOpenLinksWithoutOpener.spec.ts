import { describe, expect, it } from "vitest";

import { rehypeOpenLinksWithoutOpener } from "./rehypeOpenLinksWithoutOpener";

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

describe(rehypeOpenLinksWithoutOpener.name, () => {
  it("sets noopener and noreferrer on a link nested in other elements", () => {
    const { link } = setup({ linkProperties: { href: "https://example.com" } });

    expect(link.properties).toEqual({ href: "https://example.com", rel: ["noopener", "noreferrer"] });
  });

  it("replaces whatever rel the link carried", () => {
    const { link } = setup({ linkProperties: { href: "https://example.com", rel: ["opener"] } });

    expect(link.properties?.rel).toEqual(["noopener", "noreferrer"]);
  });

  it("sets rel on a link that had no properties, with a list of its own", () => {
    const { link, bareLink } = setup({ linkProperties: {} });

    expect(bareLink.properties).toEqual({ rel: ["noopener", "noreferrer"] });
    expect(bareLink.properties?.rel).not.toBe(link.properties?.rel);
  });

  it("leaves elements other than links untouched", () => {
    const { paragraph } = setup({ linkProperties: {} });

    expect(paragraph.properties).toEqual({ rel: ["opener"] });
  });

  function setup(input: { linkProperties: Record<string, unknown> }) {
    const link: HastNode = { type: "element", tagName: "a", properties: input.linkProperties, children: [{ type: "text" }] };
    const bareLink: HastNode = { type: "element", tagName: "a", children: [] };
    const paragraph: HastNode = { type: "element", tagName: "p", properties: { rel: ["opener"] }, children: [link] };

    rehypeOpenLinksWithoutOpener()({ type: "root", children: [paragraph, bareLink] });

    return { link, bareLink, paragraph };
  }
});
