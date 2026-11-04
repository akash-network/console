import { describe, expect, it } from "vitest";

import { rehypeDropUnsafeSrcSet } from "./rehypeDropUnsafeSrcSet";

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

describe(rehypeDropUnsafeSrcSet.name, () => {
  it.each([
    ["absolute https candidates", ["https://example.com/a.png 1x", "https://example.com/b.png 2x"]],
    ["an http candidate", ["http://example.com/a.png"]],
    ["relative candidates", ["images/a.png 1x", "/images/b.png 480w", "//cdn.example.com/c.png 2x"]],
    ["a candidate list given as one string", "https://example.com/a.png 1x, /images/b.png 2x"]
  ])("keeps a srcset of %s", (_, srcSet) => {
    const { source } = setup({ sourceProperties: { srcSet } });

    expect(source.properties).toEqual({ srcSet });
  });

  it.each([
    ["a javascript: candidate after a safe one", ["https://example.com/a.png 1x", "javascript:alert(1) 2x"]],
    ["an uppercase JAVASCRIPT: candidate", ["JAVASCRIPT:alert(1)"]],
    ["a data: candidate", ["data:image/png;base64", "iVBORw0KGgo= 1x"]],
    ["a candidate that is not a URL", ["http://[ 1x"]],
    ["a candidate list given as one string", "/images/a.png 1x, javascript:alert(1) 2x"]
  ])("drops a srcset with %s", (_, srcSet) => {
    const { source } = setup({ sourceProperties: { srcSet } });

    expect(source.properties).not.toHaveProperty("srcSet");
  });

  it("keeps the other properties of an element whose srcset it drops", () => {
    const { source } = setup({ sourceProperties: { srcSet: ["javascript:alert(1)"], media: "(prefers-color-scheme: dark)" } });

    expect(source.properties).toEqual({ media: "(prefers-color-scheme: dark)" });
  });

  it("leaves elements without a srcset untouched", () => {
    const { source, picture } = setup({ sourceProperties: { media: "(prefers-color-scheme: dark)" } });

    expect(source.properties).toEqual({ media: "(prefers-color-scheme: dark)" });
    expect(picture.properties).toEqual({});
  });

  function setup(input: { sourceProperties: Record<string, unknown> }) {
    const source: HastNode = { type: "element", tagName: "source", properties: input.sourceProperties, children: [] };
    const picture: HastNode = { type: "element", tagName: "picture", properties: {}, children: [source, { type: "text" }] };

    rehypeDropUnsafeSrcSet()({ type: "root", children: [picture] });

    return { source, picture };
  }
});
