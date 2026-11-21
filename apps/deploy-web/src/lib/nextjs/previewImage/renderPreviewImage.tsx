import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PreviewImageContent } from "@src/services/marketplace-preview-image/preview-image-content";
import { PREVIEW_IMAGE_FONT_FAMILY, PREVIEW_IMAGE_SIZE, PreviewImageLayout } from "./previewImageLayouts";

const FONT_FILES = [
  { file: "Geist-Regular.ttf", weight: 400 },
  { file: "Geist-SemiBold.ttf", weight: 600 }
] as const;

/** The fonts ship in the app's public folder, so an image is drawn without asking a font host for anything. */
const FONTS_DIRECTORY = path.join(process.cwd(), "public", "fonts", "og");

let loadedFonts: ReturnType<typeof loadFonts> | undefined;

export async function renderPreviewImage(content: PreviewImageContent): Promise<Buffer> {
  const image = new ImageResponse(<PreviewImageLayout content={content} />, { ...PREVIEW_IMAGE_SIZE, fonts: await loadFontsOnce() });

  return Buffer.from(await image.arrayBuffer());
}

function loadFontsOnce() {
  if (!loadedFonts) {
    const loading = loadFonts();
    loadedFonts = loading;
    loading.catch(() => {
      loadedFonts = undefined;
    });
  }

  return loadedFonts;
}

function loadFonts() {
  return Promise.all(
    FONT_FILES.map(async ({ file, weight }) => ({
      name: PREVIEW_IMAGE_FONT_FAMILY,
      data: await readFile(path.join(FONTS_DIRECTORY, file)),
      weight,
      style: "normal" as const
    }))
  );
}
