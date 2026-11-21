import { describe, expect, it } from "vitest";

import { COMMUNITY_TRUST_LABEL, isListedInGallery, OFFICIAL_TRUST_LABEL, toPublisherPreviewContent, toTemplatePreviewContent } from "./preview-image-content";
import { isRenderableCharacter, listRenderableCharacters } from "./preview-image-text";

import { buildTemplatePublisherPage } from "@tests/seeders/templatePublisher";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";

const GIB = 1024 ** 3;

describe(isListedInGallery.name, () => {
  const LISTED = { visibility: "public", isListed: true, publishedAt: "2026-10-01T00:00:00.000Z", moderationStatus: "active" } as const;

  it("accepts a public template the gallery lists", () => {
    expect(isListedInGallery(LISTED)).toBe(true);
  });

  it.each([
    ["is private", { visibility: "private" }],
    ["is shared with its organization only", { visibility: "organization" }],
    ["was taken out of the gallery", { isListed: false }],
    ["never passed the gallery's checks", { publishedAt: null }],
    ["is hidden by staff", { moderationStatus: "hidden" }],
    ["was removed by staff", { moderationStatus: "removed" }]
  ] as const)("refuses a template that %s", (_, change) => {
    expect(isListedInGallery({ ...LISTED, ...change })).toBe(false);
  });
});

describe(toTemplatePreviewContent.name, () => {
  it("describes a community template by its title, summary, publisher and hardware", () => {
    const template = buildMarketplaceTemplate({
      title: "Llama chat server",
      summary: "An OpenAI-compatible endpoint.",
      publisher: {
        name: "Northwind Labs",
        slug: null,
        type: "team",
        handle: "northwind",
        verified: true,
        memberSince: null,
        counts: { templates: 2, deploys: 9 }
      },
      currentVersion: buildTemplateVersion({
        resources: { cpu: 0.5, memoryBytes: 16 * GIB, storageBytes: 100 * GIB, gpu: { units: 2, models: ["rtx4090", "a100"] } }
      })
    });

    expect(toTemplatePreviewContent(template)).toEqual({
      kind: "template",
      title: "Llama chat server",
      summary: "An OpenAI-compatible endpoint.",
      trustLabel: COMMUNITY_TRUST_LABEL,
      publisher: { name: "Northwind Labs", initials: "NL", isVerified: true },
      hardware: ["2× RTX4090 / A100", "0.5 vCPU", "16 GiB memory", "100 GiB storage"]
    });
  });

  it("labels an Official template as such", () => {
    expect(toTemplatePreviewContent(buildMarketplaceTemplate({ isOfficial: true })).trustLabel).toBe(OFFICIAL_TRUST_LABEL);
  });

  it("leaves the GPU out of the hardware of a template that asks for none", () => {
    const template = buildMarketplaceTemplate({ currentVersion: buildTemplateVersion({ resources: { cpu: 1.234, memoryBytes: GIB, storageBytes: 2 * GIB } }) });

    expect(toTemplatePreviewContent(template).hardware).toEqual(["1.23 vCPU", "1 GiB memory", "2 GiB storage"]);
  });

  it("names a GPU of any model plainly", () => {
    const template = buildMarketplaceTemplate({
      currentVersion: buildTemplateVersion({ resources: { cpu: 1, memoryBytes: GIB, storageBytes: GIB, gpu: { units: 1, models: [] } } })
    });

    expect(toTemplatePreviewContent(template).hardware[0]).toBe("1× GPU");
  });

  it("cuts a long list of GPU models", () => {
    const template = buildMarketplaceTemplate({
      currentVersion: buildTemplateVersion({
        resources: { cpu: 1, memoryBytes: GIB, storageBytes: GIB, gpu: { units: 1, models: ["rtx4090", "rtx3090", "a100", "h100"] } }
      })
    });

    expect(toTemplatePreviewContent(template).hardware[0]).toBe("1× RTX4090 / RTX3090 / A10…");
  });

  it.each([
    ["has no version yet", null],
    ["has a version whose hardware is unknown", buildTemplateVersion({ resources: null })]
  ])("shows no hardware for a template that %s", (_, currentVersion) => {
    expect(toTemplatePreviewContent(buildMarketplaceTemplate({ currentVersion })).hardware).toEqual([]);
  });

  it("shows no publisher for a template without one", () => {
    expect(toTemplatePreviewContent(buildMarketplaceTemplate({ publisher: null })).publisher).toBeNull();
  });

  it("shows no summary for a template without one", () => {
    expect(toTemplatePreviewContent(buildMarketplaceTemplate({ summary: null })).summary).toBe("");
  });

  it("cuts a long title to 70 characters and a long summary to 150", () => {
    const content = toTemplatePreviewContent(buildMarketplaceTemplate({ title: "t".repeat(71), summary: "s".repeat(151) }));

    expect(content.title).toBe(`${"t".repeat(69)}…`);
    expect(content.summary).toBe(`${"s".repeat(149)}…`);
  });

  it("leaves a title of 70 characters and a summary of 150 whole", () => {
    const content = toTemplatePreviewContent(buildMarketplaceTemplate({ title: "t".repeat(70), summary: "s".repeat(150) }));

    expect(content.title).toBe("t".repeat(70));
    expect(content.summary).toBe("s".repeat(150));
  });

  it("draws only the characters the shipped fonts cover and names the template generically when none is left", () => {
    const template = buildMarketplaceTemplate({
      title: "🚀 模板",
      summary: "<script>alert(1)</script> 😀",
      publisher: { name: "株式会社", slug: null, type: "team", handle: null, verified: false, memberSince: null, counts: { templates: 1, deploys: 0 } }
    });

    expect(toTemplatePreviewContent(template)).toMatchObject({
      title: "Template on Akash Console",
      summary: "<script>alert(1)</script>",
      publisher: { name: "Community publisher", initials: "CP", isVerified: false }
    });
  });

  it("cuts a long publisher name to 40 characters", () => {
    const template = buildMarketplaceTemplate({
      publisher: { name: "n".repeat(41), slug: null, type: "team", handle: null, verified: false, memberSince: null, counts: { templates: 1, deploys: 0 } }
    });

    expect(toTemplatePreviewContent(template).publisher?.name).toBe(`${"n".repeat(39)}…`);
  });
});

describe(toPublisherPreviewContent.name, () => {
  it("describes a publisher by its name, bio and counts", () => {
    const publisher = buildTemplatePublisherPage({
      name: "Northwind Labs",
      bio: "We publish inference templates.\nOne GPU each.",
      verified: true,
      counts: { templates: 12, deploys: 3456 }
    });

    expect(toPublisherPreviewContent(publisher)).toEqual({
      kind: "publisher",
      name: "Northwind Labs",
      initials: "NL",
      isVerified: true,
      bio: "We publish inference templates. One GPU each.",
      counts: ["12 templates", "3.5K total deploys"]
    });
  });

  it("counts a single template in the singular", () => {
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ counts: { templates: 1, deploys: 0 } })).counts).toEqual(["1 template", "0 total deploys"]);
  });

  it("shows no bio for a publisher without one", () => {
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ bio: null })).bio).toBe("");
  });

  it("cuts a long bio to 170 characters and leaves one of that length whole", () => {
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ bio: "b".repeat(171) })).bio).toBe(`${"b".repeat(169)}…`);
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ bio: "b".repeat(170) })).bio).toBe("b".repeat(170));
  });

  it("names a publisher generically when its name holds nothing the shipped fonts cover", () => {
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ name: "😀😀", verified: false }))).toMatchObject({
      name: "Community publisher",
      initials: "CP",
      isVerified: false
    });
  });

  it("leaves out an initial whose capital the shipped fonts do not cover, and keeps the name", () => {
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ name: "ѝ publisher" }))).toMatchObject({ name: "ѝ publisher", initials: "P" });
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ name: "µ ѝ" }))).toMatchObject({ name: "µ ѝ", initials: "CP" });
  });

  it("keeps both letters of an initial that capitalizes to two", () => {
    expect(toPublisherPreviewContent(buildTemplatePublisherPage({ name: "ßeta labs" })).initials).toBe("SSL");
  });

  it("draws only initials the shipped fonts cover, whatever character a name starts with", () => {
    const undrawable = listRenderableCharacters()
      .map(character => toPublisherPreviewContent(buildTemplatePublisherPage({ name: `${character}x ${character}y` })).initials)
      .filter(initials => initials === "" || ![...initials].every(isRenderableCharacter));

    expect(undrawable).toEqual([]);
  });
});
