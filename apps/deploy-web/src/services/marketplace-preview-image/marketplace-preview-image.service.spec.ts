import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  MarketplaceVisitorReadsService,
  VisitorPublisherResponse,
  VisitorRead,
  VisitorTemplateResponse
} from "@src/services/marketplace-visitor-reads/marketplace-visitor-reads.service";
import { MarketplacePreviewImageService } from "./marketplace-preview-image.service";
import type { PreviewImageContent } from "./preview-image-content";

import { buildTemplatePublisherPage } from "@tests/seeders/templatePublisher";
import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";

const TEMPLATE_ID = "5f0c7f0e-6a51-4a53-9a50-0c1f3f1d2b11";
const LISTED = { visibility: "public", isListed: true, publishedAt: "2026-10-01T00:00:00.000Z", moderationStatus: "active" } as const;
const PNG = Buffer.from("drawn image");
const MINUTE = 60_000;

describe(MarketplacePreviewImageService.name, () => {
  describe("template", () => {
    it("draws a template the gallery lists from its public read", async () => {
      const template = buildMarketplaceTemplate({ ...LISTED, id: TEMPLATE_ID, title: "Llama chat server" });
      const { service, reads, render } = setup({ template: found(template) });

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "found", png: PNG });

      expect(reads.template).toHaveBeenCalledWith(TEMPLATE_ID);
      expect(render).toHaveBeenCalledWith(expect.objectContaining({ kind: "template", title: "Llama chat server" }));
    });

    it.each([
      ["private", { visibility: "private" }],
      ["shared with its organization only", { visibility: "organization" }],
      ["public but out of the gallery", { isListed: false }],
      ["public but never listed", { publishedAt: null }],
      ["hidden by staff", { moderationStatus: "hidden" }]
    ] as const)("draws nothing for a template that is %s", async (_, change) => {
      const { service, render } = setup({ template: found(buildMarketplaceTemplate({ ...LISTED, ...change })) });

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "missing" });

      expect(render).not.toHaveBeenCalled();
    });

    it.each([
      ["unknown", { status: "missing" }],
      ["removed", { status: "removed", title: "Old title" }]
    ] as const)("draws nothing for a template that is %s", async (_, read) => {
      const { service, render } = setup({ template: read });

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "missing" });

      expect(render).not.toHaveBeenCalled();
    });

    it("reports the image unavailable while the API cannot be read", async () => {
      const { service, render } = setup({ template: { status: "unavailable" } });

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "unavailable" });

      expect(render).not.toHaveBeenCalled();
    });

    it("reports the image unavailable and logs when it cannot be drawn, then draws it on the next request", async () => {
      const { service, render, logger } = setup({ template: found(buildMarketplaceTemplate(LISTED)) });
      const failure = new Error("out of memory");
      render.mockRejectedValueOnce(failure);

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "unavailable" });
      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "found", png: PNG });

      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_PREVIEW_IMAGE_RENDER_FAILED", kind: "template", error: failure });
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("draws nothing and reads nothing while the marketplace is closed to visitors", async () => {
      const { service, reads, render } = setup({ isOpen: false, template: found(buildMarketplaceTemplate(LISTED)) });

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "missing" });

      expect(reads.template).not.toHaveBeenCalled();
      expect(render).not.toHaveBeenCalled();
    });

    it("treats the marketplace as closed and logs when the flag cannot be read", async () => {
      const failure = new Error("flag service down");
      const { service, reads, logger, isMarketplaceOpenToVisitors } = setup({ template: found(buildMarketplaceTemplate(LISTED)) });
      isMarketplaceOpenToVisitors.mockRejectedValueOnce(failure);

      await expect(service.template(TEMPLATE_ID)).resolves.toEqual({ status: "missing" });

      expect(reads.template).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_PREVIEW_IMAGE_FLAG_CHECK_FAILED", error: failure });
    });

    it("draws an image once however many times it is asked for within five minutes", async () => {
      const { service, render, clock } = setup({ template: found(buildMarketplaceTemplate(LISTED)) });

      await service.template(TEMPLATE_ID);
      clock.advance(5 * MINUTE - 1);
      await service.template(TEMPLATE_ID);

      expect(render).toHaveBeenCalledTimes(1);
    });

    it("draws the image again once five minutes have passed", async () => {
      const { service, render, clock } = setup({ template: found(buildMarketplaceTemplate(LISTED)) });

      await service.template(TEMPLATE_ID);
      clock.advance(5 * MINUTE);
      await service.template(TEMPLATE_ID);

      expect(render).toHaveBeenCalledTimes(2);
    });

    it("draws a new image as soon as the template reads differently", async () => {
      const { service, reads, render } = setup({ template: found(buildMarketplaceTemplate({ ...LISTED, title: "First title" })) });

      await service.template(TEMPLATE_ID);
      reads.template.mockResolvedValue(found(buildMarketplaceTemplate({ ...LISTED, title: "Second title" })));
      await service.template(TEMPLATE_ID);

      expect(render).toHaveBeenCalledTimes(2);
      expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Second title" }));
    });

    it("asks whether the marketplace is open once in thirty seconds", async () => {
      const { service, isMarketplaceOpenToVisitors, clock } = setup({ template: found(buildMarketplaceTemplate(LISTED)) });

      await service.template(TEMPLATE_ID);
      clock.advance(30_000 - 1);
      await service.template(TEMPLATE_ID);
      expect(isMarketplaceOpenToVisitors).toHaveBeenCalledTimes(1);

      clock.advance(1);
      await service.template(TEMPLATE_ID);
      expect(isMarketplaceOpenToVisitors).toHaveBeenCalledTimes(2);
    });

    it("keeps at most 200 drawn images", async () => {
      const { service, reads, render } = setup({});
      const readTitled = (title: string) => reads.template.mockResolvedValue(found(buildMarketplaceTemplate({ ...LISTED, title, publisher: null })));

      for (let index = 0; index <= 200; index++) {
        readTitled(`Template ${index}`);
        await service.template(TEMPLATE_ID);
      }
      readTitled("Template 1");
      await service.template(TEMPLATE_ID);
      expect(render).toHaveBeenCalledTimes(201);

      readTitled("Template 0");
      await service.template(TEMPLATE_ID);
      expect(render).toHaveBeenCalledTimes(202);
    });
  });

  describe("publisher", () => {
    it("draws a publisher from its public read", async () => {
      const { service, reads, render } = setup({ publisher: foundPublisher(buildTemplatePublisherPage({ name: "Northwind Labs" })) });

      await expect(service.publisher("northwind")).resolves.toEqual({ status: "found", png: PNG });

      expect(reads.publisher).toHaveBeenCalledWith("northwind");
      expect(render).toHaveBeenCalledWith(expect.objectContaining({ kind: "publisher", name: "Northwind Labs" }));
    });

    it("draws nothing for an unknown or suspended publisher", async () => {
      const { service, render } = setup({ publisher: { status: "missing" } });

      await expect(service.publisher("nobody")).resolves.toEqual({ status: "missing" });

      expect(render).not.toHaveBeenCalled();
    });

    it("reports the image unavailable while the API cannot be read", async () => {
      const { service, render } = setup({ publisher: { status: "unavailable" } });

      await expect(service.publisher("northwind")).resolves.toEqual({ status: "unavailable" });

      expect(render).not.toHaveBeenCalled();
    });

    it("draws nothing and reads nothing while the marketplace is closed to visitors", async () => {
      const { service, reads } = setup({ isOpen: false, publisher: foundPublisher(buildTemplatePublisherPage()) });

      await expect(service.publisher("northwind")).resolves.toEqual({ status: "missing" });

      expect(reads.publisher).not.toHaveBeenCalled();
    });

    it("reports the image unavailable and logs when it cannot be drawn", async () => {
      const { service, render, logger } = setup({ publisher: foundPublisher(buildTemplatePublisherPage()) });
      const failure = new Error("renderer crashed");
      render.mockRejectedValueOnce(failure);

      await expect(service.publisher("northwind")).resolves.toEqual({ status: "unavailable" });

      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_PREVIEW_IMAGE_RENDER_FAILED", kind: "publisher", error: failure });
    });
  });

  function found(template: VisitorTemplateResponse["data"]): VisitorRead<VisitorTemplateResponse> {
    return { status: "found", data: { data: template } };
  }

  function foundPublisher(publisher: VisitorPublisherResponse["data"]): VisitorRead<VisitorPublisherResponse> {
    return { status: "found", data: { data: publisher } };
  }

  function setup(input: { isOpen?: boolean; template?: VisitorRead<VisitorTemplateResponse>; publisher?: VisitorRead<VisitorPublisherResponse> }) {
    let now = 1_000_000;
    const clock = { advance: (milliseconds: number) => (now += milliseconds) };
    const reads = mock<Pick<MarketplaceVisitorReadsService, "template" | "publisher">>();
    reads.template.mockResolvedValue(input.template ?? { status: "missing" });
    reads.publisher.mockResolvedValue(input.publisher ?? { status: "missing" });
    const isMarketplaceOpenToVisitors = vi.fn(async () => input.isOpen ?? true);
    const render = vi.fn(async (_content: PreviewImageContent) => PNG);
    const logger = mock<LoggerService>();
    const service = new MarketplacePreviewImageService(reads, isMarketplaceOpenToVisitors, render, logger, { now: () => now });

    return { service, reads, isMarketplaceOpenToVisitors, render, logger, clock };
  }
});
