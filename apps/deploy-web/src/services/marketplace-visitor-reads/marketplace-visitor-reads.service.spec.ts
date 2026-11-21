import type { TemplateHttpService } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { MarketplaceVisitorReadsService, VISITOR_READ_TIMEOUT_MS } from "./marketplace-visitor-reads.service";

import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";

const TEMPLATE_ID = "0b6bbd9c-5a3e-4d0a-9d0c-6f1a2b3c4d5e";

type Api = ReturnType<typeof createApiSdk>;

describe(MarketplaceVisitorReadsService.name, () => {
  describe("template", () => {
    it("reads a template once and serves it to the next visitor without asking again", async () => {
      const { service, v1, templateAnswer } = setup();

      expect(await service.template(TEMPLATE_ID)).toEqual({ status: "found", data: templateAnswer });
      expect(await service.template(TEMPLATE_ID.toUpperCase())).toEqual({ status: "found", data: templateAnswer });

      expect(v1.getUserTemplate.mock.calls).toEqual([[{ id: TEMPLATE_ID }]]);
    });

    it("reads it again after half a minute, so a template staff took down stops being served", async () => {
      const { service, v1, clock } = setup();
      await service.template(TEMPLATE_ID);

      clock.now = 29_999;
      await service.template(TEMPLATE_ID);
      expect(v1.getUserTemplate).toHaveBeenCalledTimes(1);

      clock.now = 30_000;
      await service.template(TEMPLATE_ID);
      expect(v1.getUserTemplate).toHaveBeenCalledTimes(2);
    });

    it.each(["not-a-uuid", "", `${TEMPLATE_ID}/versions`, `../${TEMPLATE_ID}`, ` ${TEMPLATE_ID}`])(
      "answers missing for %j without asking the API",
      async id => {
        const { service, v1 } = setup();

        expect(await service.template(id)).toEqual({ status: "missing" });
        expect(v1.getUserTemplate).not.toHaveBeenCalled();
      }
    );

    it.each([404, 400])("answers missing for a %i and asks again next time", async status => {
      const { service, v1, logger } = setup();
      v1.getUserTemplate.mockRejectedValue(new ApiError(status, { message: "Not found" }, "GET /v1/user-templates"));

      expect(await service.template(TEMPLATE_ID)).toEqual({ status: "missing" });
      expect(await service.template(TEMPLATE_ID)).toEqual({ status: "missing" });

      expect(v1.getUserTemplate).toHaveBeenCalledTimes(2);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("answers removed with the title the API still gives", async () => {
      const { service, v1 } = setup();
      v1.getUserTemplate.mockRejectedValue(new ApiError(410, { code: "template_removed", data: { title: "Open WebUI" } }, "GET /v1/user-templates"));

      expect(await service.template(TEMPLATE_ID)).toEqual({ status: "removed", title: "Open WebUI" });
    });

    it.each([
      ["a 429", new ApiError(429, { message: "Slow down" }, "GET /v1/user-templates")],
      ["a 401", new ApiError(401, { message: "Unauthorized" }, "GET /v1/user-templates")],
      ["a 500", new ApiError(500, { message: "Boom" }, "GET /v1/user-templates")],
      ["a 410 that names no removal", new ApiError(410, { message: "Gone" }, "GET /v1/user-templates")],
      ["a network failure", new TypeError("fetch failed")]
    ])("answers unavailable for %s and says so in the log", async (_, error) => {
      const { service, v1, logger } = setup();
      v1.getUserTemplate.mockRejectedValue(error);

      expect(await service.template(TEMPLATE_ID)).toEqual({ status: "unavailable" });
      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_VISITOR_READ_FAILED", read: "template", error });
    });

    it("gives up on a slow API after the timeout and serves the answer once it has arrived", async () => {
      vi.useFakeTimers();
      try {
        const { service, v1, templateAnswer, logger } = setup({ timeoutMs: undefined });
        let answer: (value: typeof templateAnswer) => void = () => {};
        v1.getUserTemplate.mockReturnValue(new Promise(resolve => (answer = resolve)));

        const slowRead = service.template(TEMPLATE_ID);
        await vi.advanceTimersByTimeAsync(VISITOR_READ_TIMEOUT_MS - 1);
        const stillWaiting = await Promise.race([slowRead, Promise.resolve("waiting")]);
        await vi.advanceTimersByTimeAsync(1);

        expect(stillWaiting).toBe("waiting");
        expect(await slowRead).toEqual({ status: "unavailable" });
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            read: "template",
            error: expect.objectContaining({ name: "VisitorReadTimeoutError", message: "The API did not answer within 2500 ms" })
          })
        );

        answer(templateAnswer);
        expect(await service.template(TEMPLATE_ID)).toEqual({ status: "found", data: templateAnswer });
        expect(v1.getUserTemplate).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("publisher", () => {
    it("reads a publisher once a minute", async () => {
      const { service, v1, publisherAnswer, clock } = setup();

      expect(await service.publisher("acme-labs")).toEqual({ status: "found", data: publisherAnswer });
      clock.now = 59_999;
      await service.publisher("acme-labs");
      expect(v1.getTemplatePublisher.mock.calls).toEqual([[{ handle: "acme-labs" }]]);

      clock.now = 60_000;
      await service.publisher("acme-labs");
      expect(v1.getTemplatePublisher).toHaveBeenCalledTimes(2);
    });

    it.each(["Acme", "acme_labs", "-acme", "acme-", "acme--labs", "", "a".repeat(65), "acme/labs", "acme labs"])(
      "answers missing for the handle %j, which no publisher can have, without asking the API",
      async handle => {
        const { service, v1 } = setup();

        expect(await service.publisher(handle)).toEqual({ status: "missing" });
        expect(v1.getTemplatePublisher).not.toHaveBeenCalled();
      }
    );

    it("asks the API for the longest handle a publisher can have", async () => {
      const { service, v1 } = setup();

      await service.publisher("a".repeat(64));

      expect(v1.getTemplatePublisher).toHaveBeenCalledTimes(1);
    });

    it("answers missing for an unknown or suspended publisher", async () => {
      const { service, v1 } = setup();
      v1.getTemplatePublisher.mockRejectedValue(new ApiError(404, { message: "Not found" }, "GET /v1/template-publishers"));

      expect(await service.publisher("nobody")).toEqual({ status: "missing" });
    });

    it("names the publisher read when it fails", async () => {
      const { service, v1, logger } = setup();
      const error = new ApiError(503, {}, "GET /v1/template-publishers");
      v1.getTemplatePublisher.mockRejectedValue(error);

      expect(await service.publisher("acme-labs")).toEqual({ status: "unavailable" });
      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_VISITOR_READ_FAILED", read: "publisher", error });
    });
  });

  describe("communityGallery", () => {
    it("reads the gallery once a minute", async () => {
      const { service, v1, galleryAnswer, clock } = setup();

      expect(await service.communityGallery()).toEqual({ status: "found", data: galleryAnswer });
      clock.now = 59_999;
      await service.communityGallery();
      expect(v1.listCommunityTemplates).toHaveBeenCalledTimes(1);

      clock.now = 60_000;
      await service.communityGallery();
      expect(v1.listCommunityTemplates).toHaveBeenCalledTimes(2);
    });

    it("names the gallery read when it fails", async () => {
      const { service, v1, logger } = setup();
      const error = new ApiError(500, {}, "GET /v1/community-templates");
      v1.listCommunityTemplates.mockRejectedValue(error);

      expect(await service.communityGallery()).toEqual({ status: "unavailable" });
      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_VISITOR_READ_FAILED", read: "community_gallery", error });
    });
  });

  describe("awesomeAkashCategories", () => {
    it("reads the awesome-akash list once every five minutes", async () => {
      const { service, templateService, clock } = setup();

      expect(await service.awesomeAkashCategories()).toEqual({ status: "found", data: [{ title: "Tools", templates: [] }] });
      clock.now = 5 * 60_000 - 1;
      await service.awesomeAkashCategories();
      expect(templateService.findGroupedByCategory).toHaveBeenCalledTimes(1);

      clock.now = 5 * 60_000;
      await service.awesomeAkashCategories();
      expect(templateService.findGroupedByCategory).toHaveBeenCalledTimes(2);
    });

    it("names the awesome-akash read when it fails", async () => {
      const { service, templateService, logger } = setup();
      const error = new Error("github down");
      templateService.findGroupedByCategory.mockRejectedValue(error);

      expect(await service.awesomeAkashCategories()).toEqual({ status: "unavailable" });
      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_VISITOR_READ_FAILED", read: "awesome_akash", error });
    });
  });

  function setup(input: { timeoutMs?: number } = { timeoutMs: 1_000 }) {
    const templateAnswer = { data: buildMarketplaceTemplate({ id: TEMPLATE_ID, visibility: "public" }) };
    const publisherAnswer = mock<Awaited<ReturnType<Api["v1"]["getTemplatePublisher"]>>>();
    const galleryAnswer = mock<Awaited<ReturnType<Api["v1"]["listCommunityTemplates"]>>>();
    const v1 = mock<Api["v1"]>();
    v1.getUserTemplate.mockResolvedValue(templateAnswer);
    v1.getTemplatePublisher.mockResolvedValue(publisherAnswer);
    v1.listCommunityTemplates.mockResolvedValue(galleryAnswer);
    const templateService = mock<Pick<TemplateHttpService, "findGroupedByCategory">>();
    templateService.findGroupedByCategory.mockResolvedValue({ data: [{ title: "Tools", templates: [] }] });
    const logger = mock<Pick<LoggerService, "warn">>();
    const clock = { now: 0 };
    const service = new MarketplaceVisitorReadsService(mock<Api>({ v1 }), templateService, logger, { timeoutMs: input.timeoutMs, now: () => clock.now });

    return { service, v1, templateService, logger, clock, templateAnswer, publisherAnswer, galleryAnswer };
  }
});
