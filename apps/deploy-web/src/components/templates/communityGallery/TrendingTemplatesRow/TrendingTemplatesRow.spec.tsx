import React from "react";
import { describe, expect, it } from "vitest";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import { TrendingTemplatesRow } from "./TrendingTemplatesRow";

import { render, screen, within } from "@testing-library/react";
import { buildGalleryEntry } from "@tests/seeders/communityTemplate";

describe(TrendingTemplatesRow.name, () => {
  it("renders nothing without trending templates", () => {
    const { container } = setup({ entries: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it("lists the trending templates in the order given, numbered, each linking to its page", () => {
    setup({
      entries: [
        buildGalleryEntry({ origin: "console", id: "first-id", title: "ComfyUI" }),
        buildGalleryEntry({ origin: "awesome-akash", id: "second-id", title: "vLLM" })
      ]
    });

    const row = screen.getByRole("region", { name: "Trending this week" });
    const links = within(row).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/template/first-id", "/templates/second-id"]);
    expect(links[0]).toHaveTextContent("1");
    expect(links[0]).toHaveTextContent("ComfyUI");
    expect(links[1]).toHaveTextContent("2");
    expect(links[1]).toHaveTextContent("vLLM");
  });

  it("names the publisher and the deploys of a community template", () => {
    setup({
      entries: [
        buildGalleryEntry({
          publisher: { name: "Northwind Labs", handle: "northwind", verified: false },
          usage: { deploys: 318, stillUpAfter24h: null, forks: 0 }
        })
      ]
    });

    expect(screen.getByText("Northwind Labs · 318 deploys")).toBeInTheDocument();
  });

  it("says Official instead of a publisher for an Official template", () => {
    setup({ entries: [buildGalleryEntry({ isOfficial: true, publisher: null, usage: { deploys: 1, stillUpAfter24h: null, forks: 0 } })] });

    expect(screen.getByText("Official · 1 deploy")).toBeInTheDocument();
  });

  it("leaves the deploys out when nobody deployed the template", () => {
    setup({ entries: [buildGalleryEntry({ publisher: { name: "Northwind Labs", handle: "northwind", verified: false } })] });

    expect(screen.getByText("Northwind Labs")).toBeInTheDocument();
    expect(screen.queryByText(/deploy/)).not.toBeInTheDocument();
  });

  it("explains what trending measures", () => {
    setup({ entries: [buildGalleryEntry()] });

    expect(screen.getByText("Deployments still running after 24 h, this week against last week")).toBeInTheDocument();
  });

  it("renders markup in a title and a publisher name as text", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { container } = setup({ entries: [buildGalleryEntry({ title: hostile, publisher: { name: hostile, handle: "x", verified: false } })] });

    expect(screen.getAllByText(hostile)).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();
  });

  function setup(input: { entries: GalleryEntry[] }) {
    return render(<TrendingTemplatesRow entries={input.entries} />);
  }
});
