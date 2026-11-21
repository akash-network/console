import { wrapApiHandlerWithSentry } from "@sentry/nextjs";
import type { NextApiHandler, NextApiResponse } from "next";

import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { services } from "@src/services/app-di-container/server-di-container.service";
import type { MarketplacePreviewImageService, PreviewImage } from "@src/services/marketplace-preview-image/marketplace-preview-image.service";

/** Short enough that a template taken down stops being pictured within minutes by any cache that honours it. */
export const PREVIEW_IMAGE_CACHE_CONTROL = "public, max-age=600, stale-while-revalidate=600";
export const MISSING_PREVIEW_IMAGE_CACHE_CONTROL = "public, max-age=60";
/** What a shared link shows while the picture cannot be drawn, so a crawler is never answered with an error. */
export const FALLBACK_PREVIEW_IMAGE_PATH = "/akash-console.png";

const READ_METHODS = ["GET", "HEAD"];

export interface PreviewImageHandlerOptions {
  route: string;
  /** The only thing the route takes from a request: the name of the path parameter holding a template id or a publisher handle. */
  param: string;
  draw(previewImages: MarketplacePreviewImageService, key: string): Promise<PreviewImage>;
}

/**
 * A public image route that never reads the session, so nothing of one caller can reach an answer every cache may keep.
 */
export function definePreviewImageHandler(options: PreviewImageHandlerOptions): NextApiHandler {
  return wrapApiHandlerWithSentry(async (req, res) => {
    if (!req.method || !READ_METHODS.includes(req.method)) {
      res.setHeader("Allow", READ_METHODS.join(", "));
      res.status(405).end();
      return;
    }

    const requestServices = (req as NextApiRequestWithServices)[REQ_SERVICES_KEY] || services;
    const key = req.query[options.param];
    const image = await drawOrFallBack(() => (typeof key === "string" ? options.draw(requestServices.marketplacePreviewImages, key) : { status: "missing" }));

    if (image.status === "found") return sendImage(res, image.png, req.method === "HEAD");
    if (image.status === "missing") return sendMissing(res);
    return sendFallback(res);

    async function drawOrFallBack(draw: () => PreviewImage | Promise<PreviewImage>): Promise<PreviewImage> {
      try {
        return await draw();
      } catch (error) {
        requestServices.errorHandler.reportError({ error, tags: { event: "PREVIEW_IMAGE_HANDLER_ERROR" } });
        return { status: "unavailable" };
      }
    }
  }, options.route);
}

function sendImage(res: NextApiResponse, png: Buffer, isHeadersOnly: boolean) {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", png.byteLength);
  res.setHeader("Cache-Control", PREVIEW_IMAGE_CACHE_CONTROL);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).end(isHeadersOnly ? undefined : png);
}

function sendMissing(res: NextApiResponse) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", MISSING_PREVIEW_IMAGE_CACHE_CONTROL);
  res.status(404).end("Not found");
}

function sendFallback(res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, FALLBACK_PREVIEW_IMAGE_PATH);
}
