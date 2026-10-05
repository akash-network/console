import { describe, expect, it } from "vitest";

import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { findSelectedCategory, isPopularTemplate, listUseCaseFilters, selectPopularTemplates, selectTemplateSections } from "./templateGalleryModel";

describe("templateGalleryModel", () => {
  describe(listUseCaseFilters.name, () => {
    it("lists All first, then every category with its template count", () => {
      const categories = [
        makeCategory("AI - GPU", [makeTemplate({ id: "llama" }), makeTemplate({ id: "comfy" })]),
        makeCategory("Databases", [makeTemplate({ id: "postgres" })])
      ];

      expect(listUseCaseFilters(categories)).toEqual([
        { category: null, label: "All", count: 3 },
        { category: "AI - GPU", label: "AI - GPU", count: 2 },
        { category: "Databases", label: "Databases", count: 1 }
      ]);
    });

    it("counts a template listed in several categories once towards All", () => {
      const categories = [makeCategory("AI - GPU", [makeTemplate({ id: "llama" })]), makeCategory("Chat", [makeTemplate({ id: "llama" })])];

      expect(listUseCaseFilters(categories)[0]).toEqual({ category: null, label: "All", count: 1 });
    });

    it("lists only All when there are no categories", () => {
      expect(listUseCaseFilters([])).toEqual([{ category: null, label: "All", count: 0 }]);
    });
  });

  describe(findSelectedCategory.name, () => {
    it("returns the category the link names", () => {
      expect(findSelectedCategory([makeCategory("Games", [])], "Games")).toBe("Games");
    });

    it("falls back to All for a category that no longer exists", () => {
      expect(findSelectedCategory([makeCategory("Games", [])], "Retired")).toBeNull();
    });

    it("returns All when the link names no category", () => {
      expect(findSelectedCategory([makeCategory("Games", [])], null)).toBeNull();
    });
  });

  describe(selectTemplateSections.name, () => {
    it("returns one section per category when showing all templates", () => {
      const categories = [makeCategory("AI - GPU", [makeTemplate({ id: "llama" })]), makeCategory("Games", [makeTemplate({ id: "minecraft" })])];

      const sections = selectTemplateSections({ categories, category: null, search: "" });

      expect(sections.map(section => section.title)).toEqual(["AI - GPU", "Games"]);
    });

    it("returns only the selected category's section", () => {
      const categories = [makeCategory("AI - GPU", [makeTemplate({ id: "llama" })]), makeCategory("Games", [makeTemplate({ id: "minecraft" })])];

      const sections = selectTemplateSections({ categories, category: "Games", search: "" });

      expect(sections).toEqual([{ title: "Games", templates: [expect.objectContaining({ id: "minecraft" })] }]);
    });

    it("keeps templates whose name or summary holds every search term, ignoring case", () => {
      const categories = [
        makeCategory("AI - GPU", [
          makeTemplate({ id: "llama", name: "Llama 3", summary: "Chat model" }),
          makeTemplate({ id: "comfy", name: "ComfyUI", summary: "Image generation" }),
          makeTemplate({ id: "chatbot", name: "Chatbot", summary: "Uses llama weights" })
        ])
      ];

      const sections = selectTemplateSections({ categories, category: null, search: "  LLAMA   chat " });

      expect(sections[0].templates.map(template => template.id)).toEqual(["llama", "chatbot"]);
    });

    it("matches whole terms rather than letters scattered through a template", () => {
      const categories = [
        makeCategory("Games", [makeTemplate({ id: "tetris", name: "Tetris", summary: "Falling blocks" }), makeTemplate({ id: "master", name: "Mastermind" })])
      ];

      const sections = selectTemplateSections({ categories, category: null, search: "ster" });

      expect(sections[0].templates.map(template => template.id)).toEqual(["master"]);
    });

    it("drops sections left without a matching template", () => {
      const categories = [
        makeCategory("AI - GPU", [makeTemplate({ id: "llama", name: "Llama" })]),
        makeCategory("Games", [makeTemplate({ id: "minecraft", name: "Minecraft" })])
      ];

      const sections = selectTemplateSections({ categories, category: null, search: "minecraft" });

      expect(sections.map(section => section.title)).toEqual(["Games"]);
    });

    it("returns no section when nothing matches", () => {
      const categories = [makeCategory("Games", [makeTemplate({ id: "minecraft", name: "Minecraft" })])];

      expect(selectTemplateSections({ categories, category: null, search: "postgres" })).toEqual([]);
    });

    it("orders featured, then recommended, then popular templates ahead of the rest", () => {
      const categories = [
        makeCategory("AI - GPU", [
          makeTemplate({ id: "plain" }),
          makeTemplate({ id: "popular", tags: ["popular"] }),
          makeTemplate({ id: "recommended", tags: ["recommended"] }),
          makeTemplate({ id: "akash-network-awesome-akash-Razer-AIKit" })
        ])
      ];

      const sections = selectTemplateSections({ categories, category: null, search: "" });

      expect(sections[0].templates.map(template => template.id)).toEqual(["akash-network-awesome-akash-Razer-AIKit", "recommended", "popular", "plain"]);
    });

    it("keeps the category's own order between templates of the same rank", () => {
      const categories = [makeCategory("Games", [makeTemplate({ id: "b" }), makeTemplate({ id: "a" }), makeTemplate({ id: "c" })])];

      const sections = selectTemplateSections({ categories, category: null, search: "" });

      expect(sections[0].templates.map(template => template.id)).toEqual(["b", "a", "c"]);
    });
  });

  describe(selectPopularTemplates.name, () => {
    it("picks the templates the gallery promotes first, up to the count", () => {
      const templates = [
        makeTemplate({ id: "plain" }),
        makeTemplate({ id: "popular", tags: ["popular"] }),
        makeTemplate({ id: "recommended", tags: ["recommended"] }),
        makeTemplate({ id: "akash-network-awesome-akash-Razer-AIKit" })
      ];

      expect(selectPopularTemplates(templates, 3).map(template => template.id)).toEqual(["akash-network-awesome-akash-Razer-AIKit", "recommended", "popular"]);
    });

    it("offers a template listed under several categories once", () => {
      const templates = [
        makeTemplate({ id: "comfy", category: "AI - GPU", tags: ["popular"] }),
        makeTemplate({ id: "comfy", category: "Images", tags: ["popular"] }),
        makeTemplate({ id: "plain" })
      ];

      expect(selectPopularTemplates(templates, 6).map(template => template.id)).toEqual(["comfy", "plain"]);
    });
  });

  describe(isPopularTemplate.name, () => {
    it("returns true for a template tagged popular", () => {
      expect(isPopularTemplate(makeTemplate({ tags: ["recommended", "popular"] }))).toBe(true);
    });

    it("returns false for a template without the popular tag", () => {
      expect(isPopularTemplate(makeTemplate({ tags: ["recommended"] }))).toBe(false);
      expect(isPopularTemplate(makeTemplate({}))).toBe(false);
    });
  });

  function makeCategory(title: string, templates: TemplateOutputSummaryWithCategory[]): EnhancedTemplateCategory {
    return { title, templates: templates.map(template => ({ ...template, category: title })) };
  }

  function makeTemplate(partial: Partial<TemplateOutputSummaryWithCategory>): TemplateOutputSummaryWithCategory {
    return {
      id: partial.id ?? "template",
      name: partial.name ?? `Template ${partial.id ?? ""}`,
      summary: partial.summary ?? "A template",
      deploy: "",
      logoUrl: null,
      category: partial.category ?? "General",
      tags: partial.tags
    };
  }
});
