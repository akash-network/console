import type { Category, TemplateSource } from "../../types/template";
import { TemplateProcessorService } from "./template-processor.service";

describe(TemplateProcessorService.name, () => {
  describe("mergeTemplateCategories", () => {
    it("returns empty array when no categories provided", () => {
      const { service } = setup();

      const result = service.mergeTemplateCategories();

      expect(result.categories).toHaveLength(0);
      expect(Object.keys(result.templatesIds)).toHaveLength(0);
    });

    it("returns categories unchanged when no duplicates exist", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t1" }] as Category["templates"] }];
      const anotherCategoriesGroup: Category[] = [{ title: "Gaming", templateSources: [], templates: [{ id: "t2" }] as Category["templates"] }];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.categories).toEqual([
        expect.objectContaining({ title: categoriesGroup[0].title }),
        expect.objectContaining({ title: anotherCategoriesGroup[0].title })
      ]);
    });

    it("merges templates from categories with same title", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t1" }] as Category["templates"] }];
      const anotherCategoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t2" }] as Category["templates"] }];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.categories).toEqual([expect.objectContaining({ title: categoriesGroup[0].title })]);
      expect(result.categories[0].templates).toEqual([expect.objectContaining({ id: "t1" }), expect.objectContaining({ id: "t2" })]);
    });

    it("merges categories case-insensitively", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t1" }] as Category["templates"] }];
      const anotherCategoriesGroup: Category[] = [{ title: "ai", templateSources: [], templates: [{ id: "t2" }] as Category["templates"] }];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.categories).toEqual([expect.objectContaining({ title: categoriesGroup[0].title })]);
      expect(result.categories[0].templates).toEqual([expect.objectContaining({ id: "t1" }), expect.objectContaining({ id: "t2" })]);
    });

    it("handles categories with undefined templates", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: undefined as unknown as Category["templates"] }];
      const anotherCategoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t1" }] as Category["templates"] }];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].templates).toHaveLength(1);
    });

    it("creates deep copy of categories to avoid mutation", () => {
      const { service } = setup();
      const originalCategory: Category = { title: "AI", templateSources: [], templates: [{ id: "t1" }] as Category["templates"] };
      const categories: Category[] = [originalCategory];

      const result = service.mergeTemplateCategories(categories);

      result.categories[0].title = "Modified";
      expect(originalCategory.title).toBe("AI");
    });

    it("returns templatesIds with correct indices for multiple categories", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t1" }] as Category["templates"] }];
      const anotherCategoriesGroup: Category[] = [{ title: "Gaming", templateSources: [], templates: [{ id: "t2" }, { id: "t3" }] as Category["templates"] }];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.templatesIds).toEqual({
        t1: { categoryIndex: 0, templateIndex: 0 },
        t2: { categoryIndex: 1, templateIndex: 0 },
        t3: { categoryIndex: 1, templateIndex: 1 }
      });
    });

    it("returns templatesIds with offset indices when merging categories with same title", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t1" }, { id: "t2" }] as Category["templates"] }];
      const anotherCategoriesGroup: Category[] = [{ title: "AI", templateSources: [], templates: [{ id: "t3" }, { id: "t4" }] as Category["templates"] }];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.templatesIds).toEqual({
        t1: { categoryIndex: 0, templateIndex: 0 },
        t2: { categoryIndex: 0, templateIndex: 1 },
        t3: { categoryIndex: 0, templateIndex: 2 },
        t4: { categoryIndex: 0, templateIndex: 3 }
      });
    });

    it("returns templatesIds with correct indices for mixed merge scenario", () => {
      const { service } = setup();
      const categoriesGroup: Category[] = [
        { title: "AI", templateSources: [], templates: [{ id: "ai-1" }] as Category["templates"] },
        { title: "Gaming", templateSources: [], templates: [{ id: "game-1" }] as Category["templates"] }
      ];
      const anotherCategoriesGroup: Category[] = [
        { title: "AI", templateSources: [], templates: [{ id: "ai-2" }] as Category["templates"] },
        { title: "Tools", templateSources: [], templates: [{ id: "tool-1" }] as Category["templates"] },
        { title: "ai", templateSources: [], templates: [{ id: "ai-3" }] as Category["templates"] },
        { title: "ai", templateSources: [] }
      ];

      const result = service.mergeTemplateCategories(categoriesGroup, anotherCategoriesGroup);

      expect(result.templatesIds).toEqual({
        "ai-1": { categoryIndex: 0, templateIndex: 0 },
        "game-1": { categoryIndex: 1, templateIndex: 0 },
        "ai-2": { categoryIndex: 0, templateIndex: 1 },
        "tool-1": { categoryIndex: 2, templateIndex: 0 },
        "ai-3": { categoryIndex: 0, templateIndex: 2 }
      });
    });
  });

  describe("getTemplateSummary", () => {
    it("returns null for empty readme", () => {
      const { service } = setup();

      const result = service.getTemplateSummary("");

      expect(result).toBeNull();
    });

    it("removes images from markdown", () => {
      const { service } = setup();
      const readme = "![Alt text](image.png)\nThis is the content.";

      const result = service.getTemplateSummary(readme);

      expect(result).toBe("This is the content.");
    });

    it("removes first header from markdown", () => {
      const { service } = setup();
      const readme = "# Main Title\n\nThis is the content.";

      const result = service.getTemplateSummary(readme);

      expect(result).toBe("This is the content.");
    });

    it("truncates summary to 200 characters with ellipsis", () => {
      const { service } = setup();
      const longContent = "A".repeat(250);
      const readme = longContent;

      const result = service.getTemplateSummary(readme);

      expect(result).toHaveLength(200);
      expect(result).toMatch(/\.\.\.$/);
    });

    it("does not truncate content shorter than 200 characters", () => {
      const { service } = setup();
      const readme = "Short content here.";

      const result = service.getTemplateSummary(readme);

      expect(result).toBe("Short content here.");
    });

    it("converts markdown to plain text", () => {
      const { service } = setup();
      const readme = "**Bold** and *italic* text with [link](http://example.com)";

      const result = service.getTemplateSummary(readme);

      expect(result).toBe("Bold and italic text with link");
    });
  });

  describe("getLinuxServerTemplateSummary", () => {
    it("returns null for empty readme", () => {
      const { service } = setup();

      const result = service.getLinuxServerTemplateSummary("");

      expect(result).toBeNull();
    });

    it("removes LinuxServer header", () => {
      const { service } = setup();
      const readme = "# [linuxserver/nginx](https://hub.docker.com/r/linuxserver/nginx)\nActual content here.";

      const result = service.getLinuxServerTemplateSummary(readme);

      expect(result).toBe("Actual content here.");
    });

    it("removes badge images from readme", () => {
      const { service } = setup();
      const readme =
        `# [linuxserver/nginx](https://hub.docker.com)\n` +
        `[![Badge1](https://img.shields.io/badge)](https://link1)\n` +
        `[![Badge2](https://img.shields.io/badge)](https://link2)\n` +
        `Actual content here.`;

      const result = service.getLinuxServerTemplateSummary(readme);

      expect(result).toBe("Actual content here.");
    });

    it("truncates summary to 200 characters with ellipsis", () => {
      const { service } = setup();
      const longContent = "B".repeat(250);
      const readme = `# [linuxserver/app](https://hub.docker.com)\n${longContent}`;

      const result = service.getLinuxServerTemplateSummary(readme);

      expect(result).toHaveLength(200);
      expect(result).toMatch(/\.\.\.$/);
    });

    it("handles readme without LinuxServer header", () => {
      const { service } = setup();
      const readme = "Regular content without special header.";

      const result = service.getLinuxServerTemplateSummary(readme);

      expect(result).toBe("Regular content without special header.");
    });
  });

  describe("replaceLinks", () => {
    it("converts relative image links to raw GitHub URLs", () => {
      const { service } = setup();
      const markdown = "![Image](./images/logo.png)";

      const result = service.replaceLinks(markdown, "owner", "repo", "main", "templates/app");

      expect(result).toBe("![Image](https://raw.githubusercontent.com/owner/repo/main/templates/app/images/logo.png)");
    });

    it("converts relative doc links to GitHub blob URLs", () => {
      const { service } = setup();
      const markdown = "[Docs](./docs/README.md)";

      const result = service.replaceLinks(markdown, "owner", "repo", "main", "templates/app");

      expect(result).toBe("[Docs](https://github.com/owner/repo/blob/main/templates/app/docs/README.md)");
    });

    it("does not modify absolute URLs", () => {
      const { service } = setup();
      const markdown = "![Image](https://example.com/image.png)";

      const result = service.replaceLinks(markdown, "owner", "repo", "main", "templates/app");

      expect(result).toBe("![Image](https://example.com/image.png)");
    });

    it("handles multiple links in same markdown", () => {
      const { service } = setup();
      const markdown = "![Img1](./img1.png) and ![Img2](./img2.png)";

      const result = service.replaceLinks(markdown, "owner", "repo", "v1.0", "folder");

      expect(result).toContain("https://raw.githubusercontent.com/owner/repo/v1.0/folder/img1.png");
      expect(result).toContain("https://raw.githubusercontent.com/owner/repo/v1.0/folder/img2.png");
    });

    it("handles links without leading dot-slash", () => {
      const { service } = setup();
      const markdown = "![Image](/images/logo.png)";

      const result = service.replaceLinks(markdown, "owner", "repo", "main", "templates");

      expect(result).toBe("![Image](https://raw.githubusercontent.com/owner/repo/main/templates/images/logo.png)");
    });

    it("preserves link text in converted links", () => {
      const { service } = setup();
      const markdown = "[Click here for docs](./documentation.md)";

      const result = service.replaceLinks(markdown, "owner", "repo", "main", "templates");

      expect(result).toBe("[Click here for docs](https://github.com/owner/repo/blob/main/templates/documentation.md)");
    });
  });

  describe("removeComments", () => {
    it("removes HTML comments from markdown", () => {
      const { service } = setup();
      const markdown = "Content <!-- hidden comment --> visible";

      const result = service.removeComments(markdown);

      expect(result).toBe("Content  visible");
    });

    it("removes content between first and last comment markers due to greedy matching", () => {
      const { service } = setup();
      const markdown = "Start <!-- comment1 --> middle <!-- comment2 --> end";

      const result = service.removeComments(markdown);

      expect(result).toBe("Start  end");
    });

    it("returns unchanged markdown when no comments present", () => {
      const { service } = setup();
      const markdown = "No comments here";

      const result = service.removeComments(markdown);

      expect(result).toBe("No comments here");
    });
  });

  describe("processTemplate", () => {
    it("returns null when readme is null", () => {
      const { service, templateSource } = setup();

      const result = service.processTemplate(templateSource, null, "deploy content", null, null);

      expect(result).toBeNull();
    });

    it("returns null when deploy is null", () => {
      const { service, templateSource } = setup();

      const result = service.processTemplate(templateSource, "readme content", null, null, null);

      expect(result).toBeNull();
    });

    it("creates template with correct id from source", () => {
      const { service, templateSource } = setup();

      const result = service.processTemplate(templateSource, "readme", "deploy", null, null);

      expect(result?.id).toBe("test-owner-test-repo-templates/app");
    });

    it("sets persistentStorageEnabled to true when deploy contains persistent: true", () => {
      const { service, templateSource } = setup();
      const deploy = "profiles:\n  compute:\n    resources:\n      storage:\n        persistent: true";

      const result = service.processTemplate(templateSource, "readme", deploy, null, null);

      expect(result?.persistentStorageEnabled).toBe(true);
    });

    it("sets persistentStorageEnabled to false when deploy does not contain persistent setting", () => {
      const { service, templateSource } = setup();
      const deploy = "simple deploy content";

      const result = service.processTemplate(templateSource, "readme", deploy, null, null);

      expect(result?.persistentStorageEnabled).toBe(false);
    });

    it("includes guide when provided", () => {
      const { service, templateSource } = setup();
      const guide = "# Guide\nStep by step instructions";

      const result = service.processTemplate(templateSource, "readme", "deploy", guide, null);

      expect(result?.guide).toBe(guide);
    });

    it("excludes guide when not provided", () => {
      const { service, templateSource } = setup();

      const result = service.processTemplate(templateSource, "readme", "deploy", null, null);

      expect(result?.guide).toBeUndefined();
    });

    it("parses config from JSON text", () => {
      const { service, templateSource } = setup();
      const configJson = '{"ssh": true, "logoUrl": "custom-logo.png"}';

      const result = service.processTemplate(templateSource, "readme", "deploy", null, configJson);

      expect(result?.config.ssh).toBe(true);
      expect(result?.config.logoUrl).toBe("custom-logo.png");
    });

    it("uses default config when config JSON is invalid", () => {
      const { service, templateSource } = setup();
      const invalidJson = "not valid json";

      const result = service.processTemplate(templateSource, "readme", "deploy", null, invalidJson);

      expect(result?.config).toEqual({ ssh: false, logoUrl: "" });
    });

    it("uses logoUrl from template source when provided", () => {
      const { service, templateSource } = setup();
      templateSource.logoUrl = "https://example.com/logo.png";

      const result = service.processTemplate(templateSource, "readme", "deploy", null, null);

      expect(result?.logoUrl).toBe("https://example.com/logo.png");
    });

    it("uses summary from template source when provided", () => {
      const { service, templateSource } = setup();
      templateSource.summary = "Custom summary from source";

      const result = service.processTemplate(templateSource, "readme", "deploy", null, null);

      expect(result?.summary).toBe("Custom summary from source");
    });

    it("generates summary from readme when not provided in source", () => {
      const { service, templateSource } = setup();
      const readme = "# Title\n\nThis is the generated summary content.";

      const result = service.processTemplate(templateSource, readme, "deploy", null, null);

      expect(result?.summary).toBe("This is the generated summary content.");
    });

    it("constructs correct GitHub URL", () => {
      const { service, templateSource } = setup();

      const result = service.processTemplate(templateSource, "readme", "deploy", null, null);

      expect(result?.githubUrl).toBe("https://github.com/test-owner/test-repo/blob/main/templates/app");
    });

    it("replaces relative links in readme", () => {
      const { service, templateSource } = setup();
      const readme = "![Logo](./logo.png)";

      const result = service.processTemplate(templateSource, readme, "deploy", null, null);

      expect(result?.readme).toContain("https://raw.githubusercontent.com/test-owner/test-repo/main/templates/app/logo.png");
    });

    it("uses logoUrl from config when source logoUrl not provided and no path match", () => {
      const { service, templateSource } = setup();
      templateSource.logoUrl = null;
      const configJson = '{"logoUrl": "config-logo.png"}';

      const result = service.processTemplate(templateSource, "readme", "deploy", null, configJson);

      expect(result?.logoUrl).toBe("config-logo.png");
    });

    it("handles persistent:true without space", () => {
      const { service, templateSource } = setup();
      const deploy = "persistent:true";

      const result = service.processTemplate(templateSource, "readme", deploy, null, null);

      expect(result?.persistentStorageEnabled).toBe(true);
    });
  });

  function setup() {
    const service = new TemplateProcessorService();
    const templateSource: TemplateSource = {
      name: "Test Template",
      path: "templates/app",
      repoOwner: "test-owner",
      repoName: "test-repo",
      repoVersion: "main"
    };
    return { service, templateSource };
  }
});
