import type { TemplateHttpService, TemplateOutput } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { MarketplaceVisitorReadsService, MAX_VISITOR_READ_LIFETIME_MS, VISITOR_READ_TIMEOUT_MS } from "./marketplace-visitor-reads.service";

import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";

const TEMPLATE_ID = "0b6bbd9c-5a3e-4d0a-9d0c-6f1a2b3c4d5e";
const AWESOME_AKASH_ID = "akash-network-awesome-akash-llama";

type Api = ReturnType<typeof createApiSdk>;

describe(MarketplaceVisitorReadsService.name, () => {
  describe("template", () => {
    it("reads a template once and serves it to the next visitor without asking again", async () => {
      const { service, v1, templateAnswer } = setup();

      expect(await service.template(TEMPLATE_ID)).toEqual({ status: "found", data: templateAnswer });
      expect(await service.template(TEMPLATE_ID.toUpperCase())).toEqual({ status: "found", data: templateAnswer });

      expect(v1.getUserTemplate.mock.calls).toEqual([[{ id: TEMPLATE_ID }, { signal: expect.any(AbortSignal) }]]);
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
    it("aborts a read the API never answers once it has run its longest lifetime, and asks again for the next visitor", async () => {
      vi.useFakeTimers();
      try {
        const { service, v1, templateAnswer } = setup();
        v1.getUserTemplate.mockReturnValueOnce(new Promise(() => undefined));

        const stalledRead = service.template(TEMPLATE_ID);
        await vi.advanceTimersByTimeAsync(MAX_VISITOR_READ_LIFETIME_MS);

        expect(await stalledRead).toEqual({ status: "unavailable" });
        expect(v1.getUserTemplate.mock.calls[0][1]?.signal?.aborted).toBe(true);

        const nextRead = service.template(TEMPLATE_ID);
        await vi.advanceTimersByTimeAsync(0);

        expect(await nextRead).toEqual({ status: "found", data: templateAnswer });
        expect(v1.getUserTemplate).toHaveBeenCalledTimes(2);
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
      expect(v1.getTemplatePublisher.mock.calls).toEqual([[{ handle: "acme-labs" }, { signal: expect.any(AbortSignal) }]]);

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
      expect(v1.listCommunityTemplates.mock.calls).toEqual([[{}, { signal: expect.any(AbortSignal) }]]);
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
      expect(templateService.findGroupedByCategory).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
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

  describe("awesomeAkashTemplate", () => {
    it("reads an awesome-akash template once every five minutes", async () => {
      const { service, templateService, llama, clock } = setup();

      expect(await service.awesomeAkashTemplate(AWESOME_AKASH_ID)).toEqual({ status: "found", data: llama });
      clock.now = 5 * 60_000 - 1;
      await service.awesomeAkashTemplate(AWESOME_AKASH_ID);
      expect(templateService.findById).toHaveBeenCalledTimes(1);
      expect(templateService.findById).toHaveBeenCalledWith(AWESOME_AKASH_ID, { signal: expect.any(AbortSignal) });

      clock.now = 5 * 60_000;
      await service.awesomeAkashTemplate(AWESOME_AKASH_ID);
      expect(templateService.findById).toHaveBeenCalledTimes(2);
    });

    it("keeps each template under its own id", async () => {
      const { service, templateService } = setup();

      await service.awesomeAkashTemplate(AWESOME_AKASH_ID);
      await service.awesomeAkashTemplate("akash-network-awesome-akash-grafana");

      expect(templateService.findById).toHaveBeenCalledTimes(2);
    });

    it.each(["", "../secrets", "a/b", "-leading-dash", "a".repeat(256), "id with space"])(
      "answers missing without asking for the impossible id %j",
      async id => {
        const { service, templateService } = setup();

        expect(await service.awesomeAkashTemplate(id)).toEqual({ status: "missing" });
        expect(templateService.findById).not.toHaveBeenCalled();
      }
    );

    it("asks for the longest id a template can have", async () => {
      const { service, templateService } = setup();
      const longestId = `A${"._-9".repeat(63)}zz`;

      await service.awesomeAkashTemplate(longestId);

      expect(longestId).toHaveLength(255);
      expect(templateService.findById).toHaveBeenCalledWith(longestId, { signal: expect.any(AbortSignal) });
    });

    it.each([400, 404])("answers missing when the list answers %i", async status => {
      const { service, templateService, logger } = setup();
      templateService.findById.mockRejectedValue(buildHttpError(status));

      expect(await service.awesomeAkashTemplate(AWESOME_AKASH_ID)).toEqual({ status: "missing" });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("answers missing when the list answers with no template", async () => {
      const { service, templateService } = setup();
      templateService.findById.mockResolvedValue(undefined as never);

      expect(await service.awesomeAkashTemplate(AWESOME_AKASH_ID)).toEqual({ status: "missing" });
    });

    it("names the template read when it fails, and asks again the next time", async () => {
      const { service, templateService, logger, llama } = setup();
      const error = buildHttpError(503);
      templateService.findById.mockRejectedValueOnce(error);

      expect(await service.awesomeAkashTemplate(AWESOME_AKASH_ID)).toEqual({ status: "unavailable" });
      expect(logger.warn).toHaveBeenCalledWith({ event: "MARKETPLACE_VISITOR_READ_FAILED", read: "awesome_akash_template", error });
      expect(await service.awesomeAkashTemplate(AWESOME_AKASH_ID)).toEqual({ status: "found", data: llama });
    });

    it("answers unavailable for a failure that carries no response", async () => {
      const { service, templateService } = setup();
      templateService.findById.mockRejectedValue(new AxiosError("socket hang up"));

      expect(await service.awesomeAkashTemplate(AWESOME_AKASH_ID)).toEqual({ status: "unavailable" });
    });

    it("aborts an awesome-akash read that never answers once it has run its longest lifetime, and asks again for the next visitor", async () => {
      vi.useFakeTimers();
      try {
        const { service, templateService, llama } = setup();
        templateService.findById.mockReturnValueOnce(new Promise(() => undefined));

        const stalledRead = service.awesomeAkashTemplate(AWESOME_AKASH_ID);
        await vi.advanceTimersByTimeAsync(MAX_VISITOR_READ_LIFETIME_MS);

        expect(await stalledRead).toEqual({ status: "unavailable" });
        expect(templateService.findById.mock.calls[0][1]?.signal?.aborted).toBe(true);

        const nextRead = service.awesomeAkashTemplate(AWESOME_AKASH_ID);
        await vi.advanceTimersByTimeAsync(0);

        expect(await nextRead).toEqual({ status: "found", data: llama });
        expect(templateService.findById).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("gives up on a slow list after the timeout", async () => {
      vi.useFakeTimers();
      try {
        const { service, templateService } = setup({ timeoutMs: 1_000 });
        templateService.findById.mockReturnValue(new Promise(() => undefined));

        const read = service.awesomeAkashTemplate(AWESOME_AKASH_ID);
        await vi.advanceTimersByTimeAsync(1_000);

        expect(await read).toEqual({ status: "unavailable" });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  function buildHttpError(status: number) {
    const config = { headers: new AxiosHeaders() };
    return new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_RESPONSE", config, undefined, {
      status,
      statusText: "",
      data: undefined,
      headers: {},
      config
    });
  }

  function setup(input: { timeoutMs?: number } = { timeoutMs: 1_000 }) {
    const templateAnswer = { data: buildMarketplaceTemplate({ id: TEMPLATE_ID, visibility: "public" }) };
    const publisherAnswer = mock<Awaited<ReturnType<Api["v1"]["getTemplatePublisher"]>>>();
    const galleryAnswer = mock<Awaited<ReturnType<Api["v1"]["listCommunityTemplates"]>>>();
    const v1 = mock<Api["v1"]>();
    v1.getUserTemplate.mockResolvedValue(templateAnswer);
    v1.getTemplatePublisher.mockResolvedValue(publisherAnswer);
    v1.listCommunityTemplates.mockResolvedValue(galleryAnswer);
    const templateService = mock<Pick<TemplateHttpService, "findGroupedByCategory" | "findById">>();
    templateService.findGroupedByCategory.mockResolvedValue({ data: [{ title: "Tools", templates: [] }] });
    const llama = mock<TemplateOutput>({ id: AWESOME_AKASH_ID, name: "Llama chat" });
    templateService.findById.mockResolvedValue(llama);
    const logger = mock<Pick<LoggerService, "warn">>();
    const clock = { now: 0 };
    const service = new MarketplaceVisitorReadsService(mock<Api>({ v1 }), templateService, logger, { timeoutMs: input.timeoutMs, now: () => clock.now });

    return { service, v1, templateService, logger, clock, templateAnswer, publisherAnswer, galleryAnswer, llama };
  }
});
