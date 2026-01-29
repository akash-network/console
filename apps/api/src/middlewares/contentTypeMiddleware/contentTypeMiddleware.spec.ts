import type { Context, Next } from "hono";
import { mock } from "jest-mock-extended";

import { contentTypeMiddleware } from "./contentTypeMiddleware";

describe("contentTypeMiddleware", () => {
  describe("when Content-Type header is missing", () => {
    it("returns 400 error with required message", async () => {
      const { middleware, ctx, next } = setup({
        contentType: undefined
      });

      await middleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith({ error: "Content-Type header is required" }, 400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("when Content-Type is not supported", () => {
    it("returns 400 error with unsupported message", async () => {
      const { middleware, ctx, next } = setup({
        contentType: "text/plain",
        supportedContentTypes: new Set(["application/json"])
      });

      await middleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith({ error: "Unsupported Content-Type" }, 400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("when Content-Type is supported", () => {
    it("calls next without returning error", async () => {
      const { middleware, ctx, next } = setup({
        contentType: "application/json",
        supportedContentTypes: new Set(["application/json"])
      });

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.json).not.toHaveBeenCalled();
    });
  });

  describe("when Content-Type includes charset", () => {
    it("strips charset and validates the base content type", async () => {
      const { middleware, ctx, next } = setup({
        contentType: "application/json; charset=utf-8",
        supportedContentTypes: new Set(["application/json"])
      });

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.json).not.toHaveBeenCalled();
    });

    it("returns 400 when base content type is not supported", async () => {
      const { middleware, ctx, next } = setup({
        contentType: "text/plain; charset=utf-8",
        supportedContentTypes: new Set(["application/json"])
      });

      await middleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith({ error: "Unsupported Content-Type" }, 400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("when multiple content types are supported", () => {
    it("accepts any of the supported content types", async () => {
      const { middleware, ctx, next } = setup({
        contentType: "text/yaml",
        supportedContentTypes: new Set(["application/json", "text/yaml", "application/x-yaml"])
      });

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.json).not.toHaveBeenCalled();
    });
  });

  function setup(input: { contentType?: string; supportedContentTypes?: Set<string> }) {
    const ctx = mock<Context>({
      req: {
        header: (name: string) => (name === "Content-Type" ? input.contentType : undefined)
      } as Context["req"]
    });
    const next = jest.fn() as jest.MockedFunction<Next>;

    const middleware = contentTypeMiddleware({
      supportedContentTypes: input.supportedContentTypes ?? new Set(["application/json"])
    });

    return { middleware, ctx, next };
  }
});
