import React from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import type { TemplateCardProps } from "./TemplateCard/TemplateCard";
import type { TemplateUseCaseNavProps } from "./TemplateUseCaseNav/TemplateUseCaseNav";
import { TemplateUseCaseNav } from "./TemplateUseCaseNav/TemplateUseCaseNav";
import type { DEPENDENCIES as URL_STATE_DEPENDENCIES } from "./useTemplateGalleryUrlState/useTemplateGalleryUrlState";
import { useTemplateGalleryUrlState } from "./useTemplateGalleryUrlState/useTemplateGalleryUrlState";
import { DEPENDENCIES, TemplateGallery } from "./TemplateGallery";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(TemplateGallery.name, () => {
  it("shows one section per category when showing all templates", () => {
    setup({ categories: [makeCategory("AI - GPU", ["Llama 3", "ComfyUI"]), makeCategory("Games", ["Minecraft"])] });

    const aiSection = screen.getByRole("region", { name: "AI - GPU" });
    expect(within(aiSection).getByText("Llama 3")).toBeInTheDocument();
    expect(within(aiSection).getByText("ComfyUI")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Games" })).getByText("Minecraft")).toBeInTheDocument();
  });

  it("shows only the category named in the link", () => {
    setup({ categories: [makeCategory("AI - GPU", ["Llama 3"]), makeCategory("Games", ["Minecraft"])], url: { category: "Games" } });

    expect(screen.getByRole("region", { name: "Games" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "AI - GPU" })).not.toBeInTheDocument();
  });

  it("shows all templates when the link names a category that no longer exists", () => {
    setup({ categories: [makeCategory("AI - GPU", ["Llama 3"]), makeCategory("Games", ["Minecraft"])], url: { category: "Retired" } });

    expect(screen.getByRole("region", { name: "AI - GPU" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Games" })).toBeInTheDocument();
  });

  it("passes the use case filters and the selected category to the rail", () => {
    const { TemplateUseCaseNav } = setup({ categories: [makeCategory("AI - GPU", ["Llama 3", "ComfyUI"])], url: { category: "AI - GPU" } });

    expect(TemplateUseCaseNav).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          { category: null, label: "All", count: 2 },
          { category: "AI - GPU", label: "AI - GPU", count: 2 }
        ],
        selectedCategory: "AI - GPU"
      }),
      {}
    );
  });

  it("puts the picked category in the link and keeps the search", () => {
    const { router, TemplateUseCaseNav } = setup({ categories: [makeCategory("Games", ["Minecraft"])], url: { search: "craft" } });

    act(() => TemplateUseCaseNav.mock.calls[0][0].onSelect("Games"));

    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=craft");
  });

  it("drops the category from the link when All is picked", () => {
    const { router, TemplateUseCaseNav } = setup({ categories: [makeCategory("Games", ["Minecraft"])], url: { category: "Games" } });

    act(() => TemplateUseCaseNav.mock.calls[0][0].onSelect(null));

    expect(router.replace).toHaveBeenCalledWith("/templates");
  });

  it("starts from the search in the link", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { search: "tetris" } });

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("tetris");
    expect(screen.getByText("Tetris")).toBeInTheDocument();
    expect(screen.queryByText("Minecraft")).not.toBeInTheDocument();
  });

  it("narrows the templates as the user types", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mine" } });

    expect(screen.getByText("Minecraft")).toBeInTheDocument();
    expect(screen.queryByText("Tetris")).not.toBeInTheDocument();
  });

  it("puts the search in the link once the user stops typing, keeping the category", async () => {
    const { router } = setup({ categories: [makeCategory("Games", ["Minecraft"])], url: { category: "Games" } });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mi" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mine" } });

    expect(router.replace).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=mine"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("clears the search and drops it from the link", async () => {
    const { router } = setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { category: "Games", search: "tetris" } });

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("");
    expect(screen.getByText("Minecraft")).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games");
  });

  it("offers no clear button while the search is empty", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])] });

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("takes the search from the link when it changes outside the page", () => {
    const { rerenderWithUrl } = setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { search: "tetris" } });

    rerenderWithUrl({ search: "mine" });

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("mine");
    expect(screen.getByText("Minecraft")).toBeInTheDocument();
  });

  it("does not write back a search it just put in the link", async () => {
    const { router, rerenderWithUrl } = setup({ categories: [makeCategory("Games", ["Minecraft"])] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "mine" } });
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    rerenderWithUrl({ search: "mine" });

    expect(screen.getByRole("textbox", { name: "Search templates" })).toHaveValue("mine");
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("says nothing matches when the search finds no template, quoting the search without its spaces", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search templates" }), { target: { value: "  postgres " } });

    expect(screen.getByText("No templates match “postgres”")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("does not show the no-match message while templates load", () => {
    setup({ categories: [], isLoading: true, url: { search: "postgres" } });

    expect(screen.queryByText(/No templates match/)).not.toBeInTheDocument();
  });

  it("does not claim nothing matches when no template could be loaded", () => {
    setup({ categories: [], isLoading: false, url: { search: "postgres" } });

    expect(screen.queryByText(/No templates match/)).not.toBeInTheDocument();
  });

  it("shows a spinner while the templates load for the first time", () => {
    setup({ categories: [], isLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps the templates on screen without a spinner while they refresh", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft"])], isLoading: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Minecraft")).toBeInTheDocument();
  });

  it("shows the templates and their counts once they load", () => {
    const { rerenderWithTemplates, TemplateUseCaseNav } = setup({ categories: [], isLoading: true });

    rerenderWithTemplates([makeCategory("Games", ["Minecraft"])]);

    expect(screen.getByText("Minecraft")).toBeInTheDocument();
    expect(TemplateUseCaseNav).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: expect.arrayContaining([{ category: "Games", label: "Games", count: 1 }]) }),
      {}
    );
  });

  it("offers no small screen filter before any template loads", () => {
    setup({ categories: [], isLoading: true });

    expect(screen.queryByRole("button", { name: /Filter by use case/ })).not.toBeInTheDocument();
  });

  it("marks popular templates for their card", () => {
    const { TemplateCard } = setup({
      categories: [{ title: "Games", templates: [makeTemplate({ name: "Minecraft", tags: ["popular"] }), makeTemplate({ name: "Tetris" })] }]
    });

    expect(TemplateCard).toHaveBeenCalledWith(expect.objectContaining({ template: expect.objectContaining({ name: "Minecraft" }), isPopular: true }), {});
    expect(TemplateCard).toHaveBeenCalledWith(expect.objectContaining({ template: expect.objectContaining({ name: "Tetris" }), isPopular: false }), {});
  });

  it("filters from a sheet on small screens and closes it after a pick", async () => {
    const { router } = setup({
      categories: [makeCategory("AI - GPU", ["Llama 3"]), makeCategory("Games", ["Minecraft"])],
      dependencies: { TemplateUseCaseNav }
    });

    await userEvent.click(screen.getByRole("button", { name: "Filter by use case: All 2" }));
    const sheet = screen.getByRole("dialog", { name: "Filter by use case" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Games 1" }));

    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the selected use case on the small screen filter button", () => {
    setup({ categories: [makeCategory("Games", ["Minecraft", "Tetris"])], url: { category: "Games" } });

    expect(screen.getByRole("button", { name: "Filter by use case: Games 2" })).toBeInTheDocument();
  });

  function makeCategory(title: string, names: string[]): EnhancedTemplateCategory {
    return { title, templates: names.map(name => makeTemplate({ name, category: title })) };
  }

  function makeTemplate(partial: Partial<TemplateOutputSummaryWithCategory>): TemplateOutputSummaryWithCategory {
    return {
      id: partial.id ?? `template-${partial.name}`,
      name: partial.name ?? "Template",
      summary: partial.summary ?? `${partial.name} summary`,
      deploy: "",
      logoUrl: null,
      category: partial.category ?? "Games",
      tags: partial.tags
    };
  }

  function setup(input: {
    categories: EnhancedTemplateCategory[];
    isLoading?: boolean;
    url?: { category?: string; search?: string };
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const router = mock<ReturnType<typeof URL_STATE_DEPENDENCIES.useRouter>>();
    let templatesResult = toTemplatesResult(input.categories, input.isLoading ?? false);
    let searchParams = toSearchParams(input.url);
    const TemplateCard = vi.fn(({ template }: TemplateCardProps) => <div>{template.name}</div>);
    const TemplateUseCaseNav = vi.fn((_props: TemplateUseCaseNavProps) => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      useTemplateGalleryUrlState: () => useTemplateGalleryUrlState({ useRouter: () => router, useSearchParams: () => searchParams }),
      useTemplates: () => templatesResult,
      TemplateCard,
      TemplateUseCaseNav,
      ...input.dependencies
    });

    const { rerender } = render(<TemplateGallery dependencies={dependencies} />);

    const rerenderWithUrl = (url: { category?: string; search?: string }) => {
      searchParams = toSearchParams(url);
      rerender(<TemplateGallery dependencies={dependencies} />);
    };

    const rerenderWithTemplates = (categories: EnhancedTemplateCategory[]) => {
      templatesResult = toTemplatesResult(categories, false);
      rerender(<TemplateGallery dependencies={dependencies} />);
    };

    return { router, TemplateCard, TemplateUseCaseNav, rerenderWithUrl, rerenderWithTemplates };
  }

  function toTemplatesResult(categories: EnhancedTemplateCategory[], isLoading: boolean) {
    return { isLoading, categories, templates: categories.flatMap(category => category.templates) };
  }

  function toSearchParams(url: { category?: string; search?: string } = {}) {
    const params = new URLSearchParams();
    if (url.category) params.set("category", url.category);
    if (url.search) params.set("search", url.search);
    return new ReadonlyURLSearchParams(params);
  }
});
