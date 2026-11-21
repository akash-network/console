import type { NextApiResponse } from "next";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { services } from "@src/services/app-di-container/server-di-container.service";
import type { MarketplacePreviewImageService, PreviewImage } from "@src/services/marketplace-preview-image/marketplace-preview-image.service";
import {
  definePreviewImageHandler,
  FALLBACK_PREVIEW_IMAGE_PATH,
  MISSING_PREVIEW_IMAGE_CACHE_CONTROL,
  PREVIEW_IMAGE_CACHE_CONTROL
} from "./definePreviewImageHandler";

const PNG = Buffer.from("drawn image");
const TEMPLATE_ID = "5f0c7f0e-6a51-4a53-9a50-0c1f3f1d2b11";

describe(definePreviewImageHandler.name, () => {
  it("sends the drawn image as a PNG any cache may keep for ten minutes", async () => {
    const { res, sentHeaders, previewImages } = await setup({ image: { status: "found", png: PNG } });

    expect(previewImages.template).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalledWith(PNG);
    expect(sentHeaders).toEqual({
      "Content-Type": "image/png",
      "Content-Length": PNG.byteLength,
      "Cache-Control": "public, max-age=600, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff"
    });
    expect(PREVIEW_IMAGE_CACHE_CONTROL).toBe(sentHeaders["Cache-Control"]);
  });

  it("answers a HEAD request with the image's headers and no body", async () => {
    const { res, sentHeaders } = await setup({ method: "HEAD", image: { status: "found", png: PNG } });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalledWith(undefined);
    expect(sentHeaders["Content-Length"]).toBe(PNG.byteLength);
  });

  it("answers 404 for an image that must not be drawn, kept by caches for a minute only", async () => {
    const { res, sentHeaders } = await setup({ image: { status: "missing" } });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalledWith("Not found");
    expect(sentHeaders).toEqual({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" });
    expect(MISSING_PREVIEW_IMAGE_CACHE_CONTROL).toBe(sentHeaders["Cache-Control"]);
  });

  it("sends the site's own picture, kept by no cache, while the image cannot be drawn", async () => {
    const { res, sentHeaders } = await setup({ image: { status: "unavailable" } });

    expect(res.redirect).toHaveBeenCalledWith(302, "/akash-console.png");
    expect(FALLBACK_PREVIEW_IMAGE_PATH).toBe("/akash-console.png");
    expect(sentHeaders).toEqual({ "Cache-Control": "no-store" });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("sends the site's own picture and reports the error when drawing throws", async () => {
    const failure = new Error("unexpected");
    const { res, sentHeaders, errorHandler } = await setup({ failure });

    expect(res.redirect).toHaveBeenCalledWith(302, FALLBACK_PREVIEW_IMAGE_PATH);
    expect(sentHeaders).toEqual({ "Cache-Control": "no-store" });
    expect(errorHandler.reportError).toHaveBeenCalledWith({ error: failure, tags: { event: "PREVIEW_IMAGE_HANDLER_ERROR" } });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS", undefined])("refuses a %s request without drawing anything", async method => {
    const { res, sentHeaders, previewImages } = await setup({ method, image: { status: "found", png: PNG } });

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalledWith();
    expect(sentHeaders).toEqual({ Allow: "GET, HEAD" });
    expect(previewImages.template).not.toHaveBeenCalled();
  });

  it("answers 404 without drawing anything when the address names several ids at once", async () => {
    const { res, previewImages } = await setup({ query: { id: [TEMPLATE_ID, "second"] }, image: { status: "found", png: PNG } });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(previewImages.template).not.toHaveBeenCalled();
  });

  it("answers 404 without drawing anything when the address names no id", async () => {
    const { res, previewImages } = await setup({ query: {}, image: { status: "found", png: PNG } });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(previewImages.template).not.toHaveBeenCalled();
  });

  it("takes nothing from the request but the id: no query value, header, cookie or session reaches the drawing", async () => {
    const getSession = vi.fn();
    const { previewImages } = await setup({
      query: { id: TEMPLATE_ID, url: "https://attacker.example/image.png", title: "Injected" },
      headers: { cookie: "appSession=secret", authorization: "Bearer secret" },
      getSession,
      image: { status: "found", png: PNG }
    });

    expect(previewImages.template.mock.calls).toEqual([[TEMPLATE_ID]]);
    expect(getSession).not.toHaveBeenCalled();
  });

  async function setup(input: {
    method?: string;
    query?: Record<string, string | string[]>;
    headers?: Record<string, string>;
    getSession?: typeof services.getSession;
    image?: PreviewImage;
    failure?: Error;
  }) {
    const previewImages = mock<MarketplacePreviewImageService>();
    if (input.failure) previewImages.template.mockRejectedValue(input.failure);
    else previewImages.template.mockResolvedValue(input.image ?? { status: "missing" });
    const errorHandler = mock<typeof services.errorHandler>();

    const req = mock<NextApiRequestWithServices>({ url: `/api/og/template/${TEMPLATE_ID}`, cookies: {} });
    req.method = "method" in input ? input.method : "GET";
    req.query = input.query ?? { id: TEMPLATE_ID };
    req.headers = input.headers ?? {};
    req[REQ_SERVICES_KEY] = { ...services, marketplacePreviewImages: previewImages, errorHandler, getSession: input.getSession ?? vi.fn() };

    const sentHeaders: Record<string, unknown> = {};
    const res = mock<NextApiResponse>({ status: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), redirect: vi.fn().mockReturnThis() });
    res.setHeader.mockImplementation((name, value) => {
      sentHeaders[name] = value;
      return res;
    });

    const handler = definePreviewImageHandler({ route: "/api/og/template/[id]", param: "id", draw: (images, id) => images.template(id) });
    await handler(req, res);

    return { req, res, sentHeaders, previewImages, errorHandler };
  }
});
