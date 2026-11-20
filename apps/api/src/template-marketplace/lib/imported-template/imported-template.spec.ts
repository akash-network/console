import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { TEMPLATE_ICONS } from "@src/template-marketplace/lib/template-catalog/template-catalog";
import {
  findImportedTemplateChanges,
  type GalleryTemplate,
  hashImportedContent,
  hasImportedTemplateChanges,
  IMPORTED_TEMPLATE_ICON,
  type ImportedTemplateContent,
  type ImportedTemplateState,
  listGalleryTemplates,
  toImportedTemplate
} from "./imported-template";

const COMMIT = "0f1e2d3c4b5a69788796a5b4c3d2e1f001234567";
const OTHER_COMMIT = "89abcdef0123456789abcdef0123456789abcdef";
const SDL = "version: '2.0'\nservices:\n  web:\n    image: nginx:1.27.0\n";

describe(toImportedTemplate.name, () => {
  it("takes the title, summary, categories, SDL and readme the gallery serves, under the gallery id", () => {
    const template = createGalleryTemplate();

    expect(toImportedTemplate(template, ["AI - GPU", "Tools"])).toEqual({
      importedRef: "akash-network-awesome-akash-comfyui",
      title: "ComfyUI",
      summary: "A node based interface for Stable Diffusion",
      categories: ["AI - GPU", "Tools"],
      sdl: SDL,
      readme: template.readme,
      contentHash: hashImportedContent({ sdl: SDL, readme: template.readme, githubUrl: template.githubUrl })
    });
  });

  it("cuts the title, the summary and the readme to the lengths a publisher's own are held to", () => {
    const imported = toImportedTemplate(
      createGalleryTemplate({ name: `${"t".repeat(79)} trailing`, summary: "s".repeat(250), readme: "r".repeat(50_010) }),
      []
    );

    expect(imported.title).toBe("t".repeat(79));
    expect(imported.summary).toBe("s".repeat(200));
    expect(imported.readme).toBe("r".repeat(50_000));
  });

  it("cuts a name after the spaces around it are gone", () => {
    const imported = toImportedTemplate(createGalleryTemplate({ name: `  ${"t".repeat(90)}` }), []);

    expect(imported.title).toBe("t".repeat(80));
  });

  it("writes a name and a summary on one line, without control characters or text direction overrides", () => {
    const imported = toImportedTemplate(createGalleryTemplate({ name: "  Open‮ WebUI\n+\tvLLM\u0000 ", summary: "First line\r\nsecond⁦ line\u007f" }), []);

    expect(imported.title).toBe("Open WebUI + vLLM");
    expect(imported.summary).toBe("First line second line");
  });

  it("keeps the readme's line breaks and tabs and drops every other control character", () => {
    const imported = toImportedTemplate(createGalleryTemplate({ readme: "# Title\r\n\n\t- item\u0000\u0007‮‏⁩ done\u009f" }), []);

    expect(imported.readme).toBe("# Title\r\n\n\t- item done");
  });

  it("names a template without a name by its gallery id, and stores a blank summary and a blank readme as none", () => {
    const imported = toImportedTemplate(createGalleryTemplate({ name: " \u0000 ", summary: "  ", readme: "\u0000" }), []);

    expect(imported).toMatchObject({ title: "akash-network-awesome-akash-comfyui", summary: null, readme: null });
  });

  it("keeps the first three distinct categories, each cleaned and cut like a name", () => {
    const imported = toImportedTemplate(createGalleryTemplate(), [" AI - GPU ", "AI\u0000 -  GPU", "", "c".repeat(70), "Tools", "Hosting"]);

    expect(imported.categories).toEqual(["AI - GPU", "c".repeat(64), "Tools"]);
  });
});

describe(hashImportedContent.name, () => {
  it("is the sha-256 of the SDL and the readme", () => {
    const hash = hashImportedContent({ sdl: SDL, readme: "# ComfyUI", githubUrl: "https://example.com/elsewhere" });

    expect(hash).toBe(
      createHash("sha256")
        .update(JSON.stringify([SDL, "# ComfyUI"]))
        .digest("hex")
    );
  });

  it("changes with the SDL and with the readme, and tells a missing readme from an empty SDL", () => {
    const githubUrl = galleryUrlAt(COMMIT);
    const hashes = [
      hashImportedContent({ sdl: SDL, readme: "# ComfyUI", githubUrl }),
      hashImportedContent({ sdl: `${SDL}\n`, readme: "# ComfyUI", githubUrl }),
      hashImportedContent({ sdl: SDL, readme: "# ComfyUI 2", githubUrl }),
      hashImportedContent({ sdl: SDL, readme: null, githubUrl }),
      hashImportedContent({ sdl: "", readme: SDL, githubUrl })
    ];

    expect(new Set(hashes).size).toBe(5);
  });

  it("stays the same when only the commit the gallery was built from moved inside the readme's links", () => {
    const readmeAt = (commit: string) =>
      `![logo](https://raw.githubusercontent.com/akash-network/awesome-akash/${commit}/comfyui/logo.png) [guide](https://github.com/akash-network/awesome-akash/blob/${commit}/comfyui/guide.md)`;

    expect(hashImportedContent({ sdl: SDL, readme: readmeAt(COMMIT), githubUrl: galleryUrlAt(COMMIT) })).toBe(
      hashImportedContent({ sdl: SDL, readme: readmeAt(OTHER_COMMIT), githubUrl: galleryUrlAt(OTHER_COMMIT) })
    );
  });

  it("still changes when a link in the readme moved to another file at the same commit", () => {
    const readmeTo = (file: string) => `[guide](https://github.com/akash-network/awesome-akash/blob/${COMMIT}/comfyui/${file})`;

    expect(hashImportedContent({ sdl: SDL, readme: readmeTo("guide.md"), githubUrl: galleryUrlAt(COMMIT) })).not.toBe(
      hashImportedContent({ sdl: SDL, readme: readmeTo("setup.md"), githubUrl: galleryUrlAt(COMMIT) })
    );
  });

  it("reads the readme as written when the gallery names no commit", () => {
    const readme = `Built at ${COMMIT}`;

    expect(hashImportedContent({ sdl: SDL, readme, githubUrl: "" })).toBe(
      createHash("sha256")
        .update(JSON.stringify([SDL, readme]))
        .digest("hex")
    );
    expect(hashImportedContent({ sdl: SDL, readme, githubUrl: `prefix ${galleryUrlAt(COMMIT)}` })).toBe(
      hashImportedContent({ sdl: SDL, readme, githubUrl: "" })
    );
  });
});

describe(findImportedTemplateChanges.name, () => {
  it("finds nothing to write for a template stored as the gallery serves it", () => {
    const next = createContent();
    const changes = findImportedTemplateChanges(createState(next), next);

    expect(changes).toEqual({ settings: {}, hasNewContent: false });
    expect(hasImportedTemplateChanges(changes)).toBe(false);
  });

  it.each<[string, Partial<ImportedTemplateContent>, object]>([
    ["a new title", { title: "ComfyUI Studio" }, { title: "ComfyUI Studio" }],
    ["a new summary", { summary: "Another summary" }, { summary: "Another summary" }],
    ["a summary that is gone", { summary: null }, { summary: null }],
    ["a category more", { categories: ["AI - GPU", "Tools"] }, { categories: ["AI - GPU", "Tools"] }],
    ["a category less", { categories: [] }, { categories: [] }],
    ["another category", { categories: ["Tools"] }, { categories: ["Tools"] }]
  ])("writes %s in place, with no new version", (_case, changed, settings) => {
    const stored = createState(createContent());
    const changes = findImportedTemplateChanges(stored, createContent(changed));

    expect(changes).toEqual({ settings, hasNewContent: false });
    expect(hasImportedTemplateChanges(changes)).toBe(true);
  });

  it("writes the categories when only one of several moved", () => {
    const stored = createState(createContent({ categories: ["AI - GPU", "Tools"] }));
    const changes = findImportedTemplateChanges(stored, createContent({ categories: ["AI - GPU", "Hosting"] }));

    expect(changes.settings).toEqual({ categories: ["AI - GPU", "Hosting"] });
  });

  it("keeps the categories staff chose, whatever the gallery files the template under", () => {
    const stored = { ...createState(createContent()), categories: ["Hosting"], hasStaffCategories: true };

    expect(findImportedTemplateChanges(stored, createContent()).settings).toEqual({});
  });

  it("lists again a template that came back to the gallery", () => {
    const next = createContent();
    const changes = findImportedTemplateChanges({ ...createState(next), isListed: false }, next);

    expect(changes).toEqual({ settings: { isListed: true }, hasNewContent: false });
    expect(hasImportedTemplateChanges(changes)).toBe(true);
  });

  it("asks for a new version when the content hash moved, and when none was stored yet", () => {
    const next = createContent();
    const moved = findImportedTemplateChanges({ ...createState(next), importedContentHash: "0".repeat(64) }, next);
    const unknown = findImportedTemplateChanges({ ...createState(next), importedContentHash: null }, next);

    expect([moved, unknown]).toEqual([
      { settings: {}, hasNewContent: true },
      { settings: {}, hasNewContent: true }
    ]);
    expect(hasImportedTemplateChanges(moved)).toBe(true);
  });
});

describe(listGalleryTemplates.name, () => {
  it("lists each template once, with every category the gallery files it under in the gallery's order", () => {
    const listings = listGalleryTemplates([
      { title: "AI - GPU", templates: [{ id: "comfyui" }, { id: "ollama" }] },
      { title: "Empty", templates: [] },
      { title: "Tools", templates: [{ id: "ollama" }, { id: "ssh-ubuntu" }] }
    ]);

    expect(listings).toEqual([
      { id: "comfyui", categories: ["AI - GPU"] },
      { id: "ollama", categories: ["AI - GPU", "Tools"] },
      { id: "ssh-ubuntu", categories: ["Tools"] }
    ]);
  });

  it("lists nothing for a gallery without categories", () => {
    expect(listGalleryTemplates([])).toEqual([]);
  });
});

describe("IMPORTED_TEMPLATE_ICON", () => {
  it("is one of the icons a template can have", () => {
    expect(TEMPLATE_ICONS).toContain(IMPORTED_TEMPLATE_ICON);
  });
});

function galleryUrlAt(commit: string): string {
  return `https://github.com/akash-network/awesome-akash/blob/${commit}/comfyui`;
}

function createGalleryTemplate(overrides: Partial<GalleryTemplate> = {}): GalleryTemplate {
  return {
    id: "akash-network-awesome-akash-comfyui",
    name: "ComfyUI",
    summary: "A node based interface for Stable Diffusion",
    readme: `# ComfyUI\n\n[guide](https://github.com/akash-network/awesome-akash/blob/${COMMIT}/comfyui/guide.md)`,
    deploy: SDL,
    githubUrl: galleryUrlAt(COMMIT),
    ...overrides
  };
}

function createContent(overrides: Partial<ImportedTemplateContent> = {}): ImportedTemplateContent {
  return { ...toImportedTemplate(createGalleryTemplate(), ["AI - GPU"]), ...overrides };
}

function createState(content: ImportedTemplateContent): ImportedTemplateState {
  return {
    title: content.title,
    summary: content.summary,
    categories: content.categories,
    isListed: true,
    importedContentHash: content.contentHash,
    hasStaffCategories: false
  };
}
