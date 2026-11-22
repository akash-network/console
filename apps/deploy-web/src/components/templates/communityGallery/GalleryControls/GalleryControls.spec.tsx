import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { GallerySort, GallerySource } from "@src/components/templates/communityGallery/galleryView";
import { GallerySortControl, GallerySourceFilter } from "./GalleryControls";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("GalleryControls", () => {
  describe(GallerySourceFilter.name, () => {
    it("offers All, Official and Community with their counts", () => {
      setupSources({ selected: "all", counts: { all: 1603, official: 327, community: 1276 } });

      const group = screen.getByRole("group", { name: "Show templates from" });
      expect(within(group).getByRole("button", { name: "All 1,603" })).toBeInTheDocument();
      expect(within(group).getByRole("button", { name: "Official 327" })).toBeInTheDocument();
      expect(within(group).getByRole("button", { name: "Community 1,276" })).toBeInTheDocument();
    });

    it("presses only the selected source", () => {
      setupSources({ selected: "community" });

      expect(screen.getByRole("button", { name: /Community/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /All/ })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /Official/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("reports the picked source", async () => {
      const { onSelect } = setupSources({ selected: "all" });

      await userEvent.click(screen.getByRole("button", { name: /Official/ }));

      expect(onSelect).toHaveBeenCalledWith("official");
    });
  });

  describe(GallerySortControl.name, () => {
    it("offers Popular, Trending and Newest and presses the selected one", () => {
      setupSort({ selected: "trending" });

      const group = screen.getByRole("group", { name: "Sort by" });
      expect(within(group).getByRole("button", { name: "Popular" })).toHaveAttribute("aria-pressed", "false");
      expect(within(group).getByRole("button", { name: "Trending" })).toHaveAttribute("aria-pressed", "true");
      expect(within(group).getByRole("button", { name: "Newest" })).toHaveAttribute("aria-pressed", "false");
    });

    it("reports the picked sort", async () => {
      const { onSelect } = setupSort({ selected: "popular" });

      await userEvent.click(screen.getByRole("button", { name: "Newest" }));

      expect(onSelect).toHaveBeenCalledWith("newest");
    });
  });

  function setupSources(input: { selected: GallerySource; counts?: Record<GallerySource, number> }) {
    const onSelect = vi.fn();
    render(<GallerySourceFilter selected={input.selected} counts={input.counts ?? { all: 3, official: 2, community: 1 }} onSelect={onSelect} />);
    return { onSelect };
  }

  function setupSort(input: { selected: GallerySort }) {
    const onSelect = vi.fn();
    render(<GallerySortControl selected={input.selected} onSelect={onSelect} />);
    return { onSelect };
  }
});
