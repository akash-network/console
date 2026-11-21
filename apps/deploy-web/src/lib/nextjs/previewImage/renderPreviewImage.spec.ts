import { describe, expect, it, vi } from "vitest";

import type { PreviewImageContent } from "@src/services/marketplace-preview-image/preview-image-content";
import { toPublisherPreviewContent, toTemplatePreviewContent } from "@src/services/marketplace-preview-image/preview-image-content";
import { listRenderableCharacters } from "@src/services/marketplace-preview-image/preview-image-text";
import { renderPreviewImage } from "./renderPreviewImage";

import { buildTemplatePublisherPage } from "@tests/seeders/templatePublisher";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const CHARACTERS_PER_IMAGE = 40;

describe(renderPreviewImage.name, () => {
  it("draws a template as a 1200 by 630 PNG without asking another host for anything", async () => {
    const template = buildMarketplaceTemplate({
      title: "Llama chat server",
      summary: "An OpenAI-compatible chat endpoint on one GPU.",
      currentVersion: buildTemplateVersion({
        resources: { cpu: 4, memoryBytes: 16 * 1024 ** 3, storageBytes: 100 * 1024 ** 3, gpu: { units: 1, models: ["rtx4090"] } }
      })
    });

    const { images, requestsToOtherHosts } = await setup({ contents: [toTemplatePreviewContent(template)] });

    expect(readPngHeader(images[0])).toEqual({ signature: PNG_SIGNATURE, width: 1200, height: 630 });
    expect(requestsToOtherHosts).not.toHaveBeenCalled();
  });

  it("draws a publisher as a 1200 by 630 PNG without asking another host for anything", async () => {
    const publisher = buildTemplatePublisherPage({ name: "Northwind Labs", bio: "We publish inference templates.", verified: true });

    const { images, requestsToOtherHosts } = await setup({ contents: [toPublisherPreviewContent(publisher)] });

    expect(readPngHeader(images[0])).toEqual({ signature: PNG_SIGNATURE, width: 1200, height: 630 });
    expect(requestsToOtherHosts).not.toHaveBeenCalled();
  });

  it("draws markup, emoji and scripts the shipped fonts lack without asking another host for a font or a picture", async () => {
    const template = buildMarketplaceTemplate({
      title: '<img src=x onerror=alert(1)> 🚀 模板 قالب <script>alert("title")</script>',
      summary: "</title><svg onload=alert(2)> 日本語 😀 ‮reversed",
      publisher: {
        name: "🔥 Ünïcode Labs 株式会社",
        slug: null,
        type: "team",
        handle: "labs",
        verified: true,
        memberSince: null,
        counts: { templates: 1, deploys: 1 }
      }
    });
    const publisher = buildTemplatePublisherPage({ name: "😀😀", bio: "<b>bold</b> 한국어 ✅ 🧪" });

    const { images, requestsToOtherHosts } = await setup({ contents: [toTemplatePreviewContent(template), toPublisherPreviewContent(publisher)] });

    expect(images.map(readPngHeader)).toEqual([
      { signature: PNG_SIGNATURE, width: 1200, height: 630 },
      { signature: PNG_SIGNATURE, width: 1200, height: 630 }
    ]);
    expect(requestsToOtherHosts).not.toHaveBeenCalled();
  });

  it("draws every character the text allowlist lets through with the shipped fonts, in both weights", async () => {
    const characters = listRenderableCharacters();
    const lines = Array.from({ length: Math.ceil(characters.length / CHARACTERS_PER_IMAGE) }, (_, index) =>
      characters.slice(index * CHARACTERS_PER_IMAGE, (index + 1) * CHARACTERS_PER_IMAGE).join("")
    );
    const contents = lines.map(
      (line): PreviewImageContent => ({
        kind: "template",
        title: line,
        summary: line,
        trustLabel: line,
        publisher: { name: line, initials: line.slice(0, 2), isVerified: false },
        hardware: [line]
      })
    );

    const { images, requestsToOtherHosts } = await setup({ contents });

    expect(images).toHaveLength(lines.length);
    expect(lines.join("")).toBe(characters.join(""));
    expect(requestsToOtherHosts).not.toHaveBeenCalled();
  });

  function readPngHeader(image: Buffer) {
    return { signature: image.subarray(0, 8).toString("hex"), width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
  }

  async function setup(input: { contents: PreviewImageContent[] }) {
    const requestsToOtherHosts = vi.fn<typeof fetch>(async () => {
      throw new Error("A preview image must not ask another host for anything");
    });
    vi.stubGlobal("fetch", requestsToOtherHosts);
    try {
      const images: Buffer[] = [];
      for (const content of input.contents) images.push(await renderPreviewImage(content));

      return { images, requestsToOtherHosts };
    } finally {
      vi.unstubAllGlobals();
    }
  }
});
