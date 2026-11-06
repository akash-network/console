import { describe, expect, it } from "vitest";

import { AKASH_SKILL_KNOWLEDGE_DOCUMENTS } from "../assistant-knowledge/akash-skill-knowledge.gen";
import {
  applyCorrections,
  curateAkashSkill,
  extractSection,
  findGuardViolations,
  renderKnowledgeModule,
  type SkillCurationManifest,
  stripRelativeLinks
} from "./akash-skill-curation";
import { AKASH_SKILL_CURATION_MANIFEST } from "./akash-skill-curation-manifest";

const SERVICES_MARKDOWN = [
  "# Services",
  "",
  "## Image",
  "",
  "Use a tag.",
  "",
  "```yaml",
  "# not a heading",
  "image: nginx:1.25.3",
  "```",
  "",
  "### Tags",
  "",
  "Pin it.",
  "",
  "#### Digests",
  "",
  "Or a digest.",
  "",
  "### Registries",
  "",
  "Credentials.",
  "",
  "## Expose",
  "",
  "Ports.",
  ""
].join("\n");

describe("akash skill curation", () => {
  describe(extractSection.name, () => {
    it("returns the section body with its nested sections, up to the next heading of the same level", () => {
      expect(extractSection(SERVICES_MARKDOWN, "## Image")).toBe(
        [
          "Use a tag.",
          "",
          "```yaml",
          "# not a heading",
          "image: nginx:1.25.3",
          "```",
          "",
          "### Tags",
          "",
          "Pin it.",
          "",
          "#### Digests",
          "",
          "Or a digest.",
          "",
          "### Registries",
          "",
          "Credentials."
        ].join("\n")
      );
    });

    it("stops a nested section at the next heading of the same or a higher level", () => {
      expect(extractSection(SERVICES_MARKDOWN, "#### Digests")).toBe("Or a digest.");
      expect(extractSection(SERVICES_MARKDOWN, "### Registries")).toBe("Credentials.");
    });

    it("reads the last section up to the end of the document", () => {
      expect(extractSection(SERVICES_MARKDOWN, "## Expose")).toBe("Ports.");
    });

    it("ignores heading-like lines inside backtick and tilde code fences, indented or not", () => {
      const markdown = ["## Example", "  ```", "## inside", "  ```", "~~~", "# also inside", "~~~", "text", "## Next", "after"].join("\n");

      expect(extractSection(markdown, "## Example")).toBe(["```", "## inside", "  ```", "~~~", "# also inside", "~~~", "text"].join("\n"));
      expect(extractSection(markdown, "## Next")).toBe("after");
    });

    it("treats a hash inside a line or without a following space as text", () => {
      const markdown = ["## Example", "Run a # b", "#hashtag", "Wrap code in ``` fences", "## Next"].join("\n");

      expect(extractSection(markdown, "## Example")).toBe("Run a # b\n#hashtag\nWrap code in ``` fences");
    });

    it("matches a heading only as a whole heading line", () => {
      expect(() => extractSection("Text ## Image\n## Imagery\nx", "## Image")).toThrow('section "## Image" not found');
      expect(() => extractSection("```\n## Image\n```", "## Image")).toThrow('section "## Image" not found');
    });

    it("drops omitted nested sections with everything under them", () => {
      expect(extractSection(SERVICES_MARKDOWN, "## Image", ["### Tags"])).toBe(
        ["Use a tag.", "", "```yaml", "# not a heading", "image: nginx:1.25.3", "```", "", "### Registries", "", "Credentials."].join("\n")
      );
      expect(extractSection(SERVICES_MARKDOWN, "## Image", ["### Tags", "### Registries"])).toBe(
        ["Use a tag.", "", "```yaml", "# not a heading", "image: nginx:1.25.3", "```"].join("\n")
      );
    });

    it("drops an omitted section that runs to the end of the selected one", () => {
      expect(extractSection(SERVICES_MARKDOWN, "### Tags", ["#### Digests"])).toBe("Pin it.");
    });

    it("omits the nested heading itself, not a code line with the same text", () => {
      const markdown = ["## Proxy", "```", "### Tuning", "```", "### Tuning", "Unsupported."].join("\n");

      expect(extractSection(markdown, "## Proxy", ["### Tuning"])).toBe("```\n### Tuning\n```");
    });

    it("fails when an omitted section does not exist, so a renamed heading is noticed", () => {
      expect(() => extractSection(SERVICES_MARKDOWN, "## Image", ["### Proxy"])).toThrow('nested section "### Proxy" not found');
    });
  });

  describe(stripRelativeLinks.name, () => {
    it("keeps the text of links to other skill files and keeps web links", () => {
      expect(stripRelativeLinks("Read [storage](../reference/storage-classes.md#beta2), [docs](https://akash.network) and [old](http://x.dev).")).toBe(
        "Read storage, [docs](https://akash.network) and [old](http://x.dev)."
      );
    });

    it("drops lines that point the reader to another file", () => {
      expect(stripRelativeLinks("Keep this.\nSee [rules](rules.md) for more.\nSeeds and Seen stay.\nWe See it.")).toBe(
        "Keep this.\nSeeds and Seen stay.\nWe See it."
      );
    });
  });

  describe(applyCorrections.name, () => {
    it("replaces every occurrence of each correction, in order", () => {
      expect(
        applyCorrections("denom: uakt\ndenom: uakt\nmax 64 CPU", [
          { find: "denom: uakt", replace: "denom: uact" },
          { find: /\d+ CPU/g, replace: "N CPU" },
          { find: "denom: uact\n", replace: "" }
        ])
      ).toBe("max N CPU");
    });

    it("corrects what the pinned skill gets wrong for Console", () => {
      const corrected = applyCorrections(
        "pricing:\n  denom: uakt\nThe container image to deploy. **Must include an explicit tag** - the `latest` tag is not allowed.",
        AKASH_SKILL_CURATION_MANIFEST.corrections
      );

      expect(corrected).toContain("denom: uact");
      expect(corrected).toContain("Console accepts `latest`");
      expect(findGuardViolations(corrected, AKASH_SKILL_CURATION_MANIFEST.guards)).toEqual([]);
    });
  });

  describe(findGuardViolations.name, () => {
    it("reports the reason of every guard the text trips", () => {
      const guards = [
        { pattern: /uakt/, reason: "uakt" },
        { pattern: /deposit/i, reason: "deposit" },
        { pattern: /mnemonic/, reason: "mnemonic" }
      ];

      expect(findGuardViolations("Deposit 5 uakt", guards)).toEqual(["uakt", "deposit"]);
      expect(findGuardViolations("nothing here", guards)).toEqual([]);
    });

    it.each([
      ["denom: uakt", "uakt"],
      ["provider-services tx deployment deposit 5000000uact --from wallet", "deposit"],
      ['{ "resources": [ { "resources": {} } ] }', "bid screening"],
      ["POST /v1/bid-screening", "bid screening"],
      ["the `latest` tag is not allowed", "latest"],
      ["Higher pricing increases the likelihood of provider acceptance", "price"],
      ["Check pricing in SDL (may be too low)", "price"],
      ["akt deploy deploy.yaml", "CLI"],
      ["Call api.akashml.com", "AkashML"],
      ['curl -H "x-api-key: $KEY"', "Console API"],
      ["Run python3 scripts/match_providers.py", "skill file"],
      ["buffering_disable: true", "proxy tuning"]
    ])("flags outdated or non-Console guidance in %s", (text, reasonPart) => {
      const reasons = findGuardViolations(text, AKASH_SKILL_CURATION_MANIFEST.guards).join(" ");

      expect(reasons.toLowerCase()).toContain(reasonPart.toLowerCase());
    });

    it("finds nothing outdated in the committed generated knowledge", () => {
      const violations = AKASH_SKILL_KNOWLEDGE_DOCUMENTS.flatMap(({ markdown }) => findGuardViolations(markdown, AKASH_SKILL_CURATION_MANIFEST.guards));

      expect(violations).toEqual([]);
    });
  });

  describe(curateAkashSkill.name, () => {
    it("turns each selected section into a titled chunk, with corrections and the Console note applied", () => {
      const documents = setup({
        sections: [
          { heading: "### Registries", title: "Private registries", consoleNote: "set them on a running deployment." },
          { heading: "## Expose", title: "Ports" }
        ],
        files: { "rules/services.md": "### Registries\n\nSee [x](x.md).\n\n\n\nCredentials uakt.\n\n\n\nMore.\n## Expose\nPorts." }
      }).curate();

      expect(documents).toEqual([
        {
          id: "akash-services",
          title: "Akash services",
          source: "akash-network/akash-skill v9.9.9 (MIT): rules/services.md",
          markdown: "\n## Private registries\nCredentials uact.\n\nMore.\n\nIn Console: set them on a running deployment.\n\n## Ports\nPorts.\n"
        }
      ]);
    });

    it("accepts a chunk exactly at the length limit", () => {
      const documents = setup({ maxChunkLength: 10, files: { "rules/services.md": "## Expose\n1234567890" } }).curate();

      expect(documents[0].markdown).toBe("\n## Ports\n1234567890\n");
    });

    it("lists every problem at once instead of writing a partial pack", () => {
      const { curate } = setup({
        maxChunkLength: 10,
        sections: [
          { heading: "## Missing", title: "Missing" },
          { heading: "## Long", title: "Long" },
          { heading: "## Empty", title: "Empty" },
          { heading: "## Guarded", title: "Guarded" },
          { heading: "# Top", title: "Top" },
          { heading: "## Twin", title: "Long!" }
        ],
        files: { "rules/services.md": "## Long\n12345678901\n## Empty\n## Guarded\nmnemonic\n## Twin\na ## b\n# Top\nintro\n## Nested\nbody" }
      });

      expect(curate).toThrow(
        [
          "The Akash skill cannot be curated as configured:",
          '- rules/services.md ## Missing: section "## Missing" not found',
          "- rules/services.md ## Long: is 11 characters, over the 10 limit",
          "- rules/services.md ## Empty: is empty",
          "- rules/services.md ## Guarded: describes a self-custody flow",
          "- rules/services.md # Top: contains a second-level heading, which would split the chunk",
          "- rules/services.md # Top: is 20 characters, over the 10 limit",
          '- rules/services.md ## Twin: title "Long!" repeats a chunk id in akash-services'
        ].join("\n")
      );
    });
  });

  describe(renderKnowledgeModule.name, () => {
    it("renders a typed module that records the pinned source and keeps markdown intact", async () => {
      const documents = [{ id: "akash-sdl", title: 'The "SDL"', source: "skill", markdown: "\n## Code\n`a` \\n ${b} ```\n" }];

      const rendered = renderKnowledgeModule(AKASH_SKILL_CURATION_MANIFEST, documents);
      const module = await import(
        `data:text/javascript,${encodeURIComponent(
          rendered
            .replace(/^import type .*$/m, "")
            .replace(": KnowledgeDocument[]", "")
            .replace(" as const", "")
        )}`
      );

      expect(rendered.startsWith('import type { KnowledgeDocument } from "./assistant-knowledge-pack";\n\n/** Generated by')).toBe(true);
      expect(rendered).toContain(
        `export const AKASH_SKILL_KNOWLEDGE_SOURCE = {\n  repository: "akash-network/akash-skill",\n  version: "${AKASH_SKILL_CURATION_MANIFEST.version}",`
      );
      expect(rendered.endsWith("];\n")).toBe(true);
      expect(module.AKASH_SKILL_KNOWLEDGE_DOCUMENTS).toEqual(documents);
      expect(module.AKASH_SKILL_KNOWLEDGE_SOURCE).toEqual({
        repository: "akash-network/akash-skill",
        version: AKASH_SKILL_CURATION_MANIFEST.version,
        commit: AKASH_SKILL_CURATION_MANIFEST.commit,
        license: "MIT"
      });
    });

    it("renders the documents in order, one object each", () => {
      const rendered = renderKnowledgeModule(AKASH_SKILL_CURATION_MANIFEST, [
        { id: "first", title: "First", source: "s", markdown: "a" },
        { id: "second", title: "Second", source: "s", markdown: "b" }
      ]);

      expect(rendered).toContain(
        [
          '  {\n    id: "first",\n    title: "First",\n    source: "s",\n    markdown: `a`\n  },',
          '  {\n    id: "second",\n    title: "Second",\n    source: "s",\n    markdown: `b`\n  }\n];'
        ].join("\n")
      );
    });
  });

  function setup(input: { sections?: SkillCurationManifest["files"][number]["sections"]; files?: Record<string, string>; maxChunkLength?: number }) {
    const manifest: SkillCurationManifest = {
      repository: "akash-network/akash-skill",
      version: "v9.9.9",
      commit: "abc123",
      license: "MIT",
      maxChunkLength: input.maxChunkLength ?? 1_000,
      files: [
        { path: "rules/services.md", id: "akash-services", title: "Akash services", sections: input.sections ?? [{ heading: "## Expose", title: "Ports" }] }
      ],
      corrections: [{ find: "uakt", replace: "uact" }],
      guards: [{ pattern: /mnemonic/, reason: "describes a self-custody flow" }]
    };
    const curate = () => curateAkashSkill(manifest, path => input.files?.[path] ?? "");

    return { manifest, curate };
  }
});
