import React from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { DEPENDENCIES, TemplateGallery } from "./TemplateGallery";

import { render, screen } from "@testing-library/react";

describe(TemplateGallery.name, () => {
  it("renders featured template first regardless of tags", () => {
    const { TemplateBox } = setup({
      templates: [
        makeTemplate({ id: "plain-id", name: "Plain Template" }),
        makeTemplate({ id: "other-id", name: "Recommended Template", tags: ["recommended"] }),
        makeTemplate({ id: "akash-network-awesome-akash-openclaw", name: "Featured Template" })
      ]
    });

    const calls = TemplateBox.mock.calls.map(([props]) => props.template.name);
    expect(calls[0]).toBe("Featured Template");
    expect(calls.indexOf("Featured Template")).toBeLessThan(calls.indexOf("Recommended Template"));
  });

  it("renders recommended templates before popular ones", () => {
    const { TemplateBox } = setup({
      templates: [
        makeTemplate({ id: "plain-id", name: "Plain Template" }),
        makeTemplate({ id: "pop-id", name: "Popular Template", tags: ["popular"] }),
        makeTemplate({ id: "rec-id", name: "Recommended Template", tags: ["recommended"] })
      ]
    });

    const calls = TemplateBox.mock.calls.map(([props]) => props.template.name);
    expect(calls.indexOf("Recommended Template")).toBeLessThan(calls.indexOf("Popular Template"));
  });

  it("renders popular templates before plain ones", () => {
    const { TemplateBox } = setup({
      templates: [makeTemplate({ id: "plain-id", name: "Plain Template" }), makeTemplate({ id: "pop-id", name: "Popular Template", tags: ["popular"] })]
    });

    const calls = TemplateBox.mock.calls.map(([props]) => props.template.name);
    expect(calls.indexOf("Popular Template")).toBeLessThan(calls.indexOf("Plain Template"));
  });

  it("passes isRecommended=true to TemplateBox for recommended templates", () => {
    const { TemplateBox } = setup({
      templates: [makeTemplate({ id: "rec-id", name: "Recommended Template", tags: ["recommended"] })]
    });

    expect(TemplateBox).toHaveBeenCalledWith(expect.objectContaining({ isRecommended: true }), {});
  });

  it("passes isPopular=true to TemplateBox for popular templates", () => {
    const { TemplateBox } = setup({
      templates: [makeTemplate({ id: "pop-id", name: "Popular Template", tags: ["popular"] })]
    });

    expect(TemplateBox).toHaveBeenCalledWith(expect.objectContaining({ isPopular: true }), {});
  });

  it("passes isRecommended=false and isPopular=false for plain templates", () => {
    const { TemplateBox } = setup({
      templates: [makeTemplate({ id: "plain-id", name: "Plain Template" })]
    });

    expect(TemplateBox).toHaveBeenCalledWith(expect.objectContaining({ isRecommended: false, isPopular: false }), {});
  });

  it("filters templates by search term when search query is provided", () => {
    const { TemplateBox } = setup({
      templates: [
        makeTemplate({ id: "t1", name: "Nginx Template", summary: "Web server" }),
        makeTemplate({ id: "t2", name: "Postgres Database", summary: "SQL database" })
      ],
      search: "nginx"
    });

    const names = TemplateBox.mock.calls.map(([props]) => props.template.name);
    expect(names).toContain("Nginx Template");
    expect(names).not.toContain("Postgres Database");
  });

  it("shows all templates when no search query", () => {
    setup({
      templates: [makeTemplate({ id: "t1", name: "Template One" }), makeTemplate({ id: "t2", name: "Template Two" })]
    });

    expect(screen.getByText("Template One")).toBeInTheDocument();
    expect(screen.getByText("Template Two")).toBeInTheDocument();
  });

  function makeTemplate(partial: Partial<TemplateOutputSummaryWithCategory>): TemplateOutputSummaryWithCategory {
    return {
      id: partial.id ?? "template-default",
      name: partial.name ?? "Default Template",
      summary: partial.summary ?? "Default summary",
      deploy: partial.deploy ?? "",
      logoUrl: null,
      category: partial.category ?? "AI & ML",
      tags: partial.tags
    };
  }

  function setup(input: { templates?: TemplateOutputSummaryWithCategory[]; categories?: EnhancedTemplateCategory[]; search?: string } = {}) {
    const templates = input.templates ?? [];
    const categories = input.categories ?? [];

    const searchParamsMap = new Map<string, string>();
    if (input.search) searchParamsMap.set("search", input.search);
    const mockSearchParams = {
      get: (key: string) => searchParamsMap.get(key) ?? null
    } as unknown as ReadonlyURLSearchParams;

    const mockRouter = { replace: vi.fn() };

    const Layout = vi.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
    const CustomNextSeo = vi.fn(() => null);
    const MobileTemplatesFilter = vi.fn(() => null);
    const TemplateBox = vi.fn(({ template }: { template: TemplateOutputSummaryWithCategory }) => <div>{template.name}</div>);

    const dependencies = {
      ...DEPENDENCIES,
      useRouter: () => mockRouter,
      useSearchParams: () => mockSearchParams,
      useTemplates: () => ({ isLoading: false, templates, categories }),
      Layout,
      CustomNextSeo,
      MobileTemplatesFilter,
      TemplateBox
    } as unknown as typeof DEPENDENCIES;

    render(<TemplateGallery dependencies={dependencies} />);

    return { mockRouter, TemplateBox, Layout };
  }
});
