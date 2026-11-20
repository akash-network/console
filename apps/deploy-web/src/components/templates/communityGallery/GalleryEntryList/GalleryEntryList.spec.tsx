import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { GalleryEntry } from "@src/components/templates/communityGallery/galleryEntries";
import { GALLERY_PAGE_SIZE } from "@src/components/templates/communityGallery/galleryEntries";
import { COMMUNITY_GALLERY_NOTE, GalleryEntryList } from "./GalleryEntryList";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGalleryEntry } from "@tests/seeders/communityTemplate";

describe(GalleryEntryList.name, () => {
  it("titles the section and lists a card per template in the order given", () => {
    setup({ title: "All templates · Popular", entries: [buildGalleryEntry({ title: "First" }), buildGalleryEntry({ title: "Second" })] });

    const section = screen.getByRole("region", { name: "All templates · Popular" });
    expect(
      within(section)
        .getAllByTestId("card")
        .map(card => card.textContent)
    ).toEqual(["First", "Second"]);
  });

  it("says community templates are not reviewed by Akash when asked to", () => {
    setup({ entries: [buildGalleryEntry()], showsCommunityNote: true });

    expect(screen.getByText(COMMUNITY_GALLERY_NOTE)).toBeInTheDocument();
  });

  it("leaves the community note out of a list of Official templates", () => {
    setup({ entries: [buildGalleryEntry()], showsCommunityNote: false });

    expect(screen.queryByText(COMMUNITY_GALLERY_NOTE)).not.toBeInTheDocument();
  });

  it("shows the first page and no Show more when everything fits", () => {
    setup({ entries: makeEntries(GALLERY_PAGE_SIZE) });

    expect(screen.getAllByTestId("card")).toHaveLength(GALLERY_PAGE_SIZE);
    expect(screen.queryByRole("button", { name: "Show more templates" })).not.toBeInTheDocument();
  });

  it("shows one more page each time Show more is clicked, until everything is shown", async () => {
    setup({ entries: makeEntries(GALLERY_PAGE_SIZE * 2 + 1) });

    expect(screen.getAllByTestId("card")).toHaveLength(GALLERY_PAGE_SIZE);

    await userEvent.click(screen.getByRole("button", { name: "Show more templates" }));
    expect(screen.getAllByTestId("card")).toHaveLength(GALLERY_PAGE_SIZE * 2);

    await userEvent.click(screen.getByRole("button", { name: "Show more templates" }));
    expect(screen.getAllByTestId("card")).toHaveLength(GALLERY_PAGE_SIZE * 2 + 1);
    expect(screen.queryByRole("button", { name: "Show more templates" })).not.toBeInTheDocument();
  });

  it("says nothing matches the search, quoting it without its spaces", () => {
    setup({ entries: [], search: "  zzz  " });

    expect(screen.getByText("No templates match “zzz”")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });

  it("says there are no templates yet when the filters alone leave none", () => {
    setup({ entries: [], search: "   " });

    expect(screen.getByText("No templates here yet")).toBeInTheDocument();
    expect(screen.getByText("Try a different search, another use case, or All templates.")).toBeInTheDocument();
  });

  it("shows no empty message when there are templates", () => {
    setup({ entries: [buildGalleryEntry()], search: "x" });

    expect(screen.queryByText(/No templates/)).not.toBeInTheDocument();
  });

  it("renders markup in the search as text", () => {
    const { container } = setup({ entries: [], search: "<img src=x onerror=alert(1)>" });

    expect(screen.getByText("No templates match “<img src=x onerror=alert(1)>”")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  function makeEntries(count: number) {
    return Array.from({ length: count }, (_, index) => buildGalleryEntry({ title: `Template ${index}` }));
  }

  function setup(input: { title?: string; entries: GalleryEntry[]; search?: string; showsCommunityNote?: boolean }) {
    const GalleryEntryCard = vi.fn(({ entry }: { entry: GalleryEntry }) => <div data-testid="card">{entry.title}</div>);

    return render(
      <GalleryEntryList
        title={input.title ?? "All templates · Popular"}
        entries={input.entries}
        search={input.search ?? ""}
        showsCommunityNote={input.showsCommunityNote ?? true}
        dependencies={{ GalleryEntryCard }}
      />
    );
  }
});
