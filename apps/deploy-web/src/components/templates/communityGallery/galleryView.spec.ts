import { describe, expect, it } from "vitest";

import { isSameGalleryView, readGalleryView } from "./galleryView";

describe(readGalleryView.name, () => {
  it("reads a link with no query as the gallery's default view", () => {
    expect(readGalleryView({})).toEqual({ category: null, search: "", source: "all", sort: "popular" });
  });

  it("reads the category, search, source and sort a link carries", () => {
    expect(readGalleryView({ category: "AI - GPU", search: "llama chat", source: "community", sort: "newest" })).toEqual({
      category: "AI - GPU",
      search: "llama chat",
      source: "community",
      sort: "newest"
    });
  });

  it("reads unknown sources and sorts as the defaults, and an empty category as none", () => {
    expect(readGalleryView({ category: "", source: "staff", sort: "random" })).toEqual({ category: null, search: "", source: "all", sort: "popular" });
  });

  it("reads the first value of a parameter given twice, as the browser does", () => {
    expect(readGalleryView({ category: ["Tools", "Games"], search: ["a", "b"], source: ["official", "community"], sort: ["trending", "newest"] })).toEqual({
      category: "Tools",
      search: "a",
      source: "official",
      sort: "trending"
    });
  });
});

describe(isSameGalleryView.name, () => {
  const view = { category: "Tools", search: "grafana", source: "official", sort: "newest" } as const;

  it("says two views with the same four choices are the same", () => {
    expect(isSameGalleryView(view, { ...view })).toBe(true);
  });

  it.each([{ category: null }, { search: "" }, { source: "all" as const }, { sort: "popular" as const }])(
    "says views differing by %j are not the same",
    change => {
      expect(isSameGalleryView(view, { ...view, ...change })).toBe(false);
    }
  );
});
