import type { Context, Next } from "hono";
import type { MiddlewareHandler } from "hono";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { AuthService } from "../../../auth/services/auth.service";
import { SECURITY_NONE } from "../../services/openapi-docs/openapi-security";
import { createRoute } from "./create-route";

describe(createRoute.name, () => {
  afterEach(() => {
    container.clearInstances();
  });

  describe("when given GET config", () => {
    it("adds cache control middleware with no-store by default", async () => {
      const { route, ctx, next, getHeader } = setup({
        method: "get",
        path: "/test"
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(1);

      await middlewares[0](ctx, next);

      expect(next).toHaveBeenCalled();
      expect(getHeader("Cache-Control")).toBe("public, no-store");
    });

    it("adds cache control middleware with cache config when provided", async () => {
      const { route, ctx, next, getHeader } = setup({
        method: "get",
        path: "/test",
        cache: { maxAge: 60, staleWhileRevalidate: 120 }
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(1);

      await middlewares[0](ctx, next);

      expect(next).toHaveBeenCalled();
      expect(getHeader("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=120");
    });

    it("uses private cache scope for authenticated requests", async () => {
      const { route, ctx, next, getHeader } = setup({
        method: "get",
        path: "/test",
        cache: { maxAge: 60 },
        currentUser: { userId: "user-123" }
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      await middlewares[0](ctx, next);

      expect(getHeader("Cache-Control")).toBe("private, max-age=60");
    });
  });

  describe("when given HEAD config", () => {
    it("adds cache control middleware", async () => {
      const { route, ctx, next } = setup({
        method: "head",
        path: "/test"
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(1);

      await middlewares[0](ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("when given OPTIONS config", () => {
    it("adds body limit and cache control middleware", async () => {
      const { route, ctx, next, getHeader } = setup({
        method: "options",
        path: "/test"
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(2);

      await middlewares[1](ctx, next);

      expect(next).toHaveBeenCalled();
      expect(getHeader("Cache-Control")).toBe("public, no-store");
    });
  });

  describe("when given POST config", () => {
    it("adds body limit middleware", () => {
      const { route } = setup({
        method: "post",
        path: "/test"
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(1);
    });
  });

  describe("when given POST config with request body content", () => {
    it("adds content type middleware that validates Content-Type header", async () => {
      const { route, ctx, next } = setup({
        method: "post",
        path: "/test",
        request: {
          body: {
            content: {
              "application/json": {
                schema: { type: "object" as const }
              }
            }
          }
        }
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(2);

      await middlewares[1](ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it("rejects unsupported Content-Type", async () => {
      const { route, ctx, next } = setup({
        method: "post",
        path: "/test",
        contentType: "text/plain",
        request: {
          body: {
            content: {
              "application/json": {
                schema: { type: "object" as const }
              }
            }
          }
        }
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      await middlewares[1](ctx, next);

      expect(ctx.json).toHaveBeenCalledWith({ error: "Unsupported Content-Type" }, 400);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects missing Content-Type header", async () => {
      const { route, ctx, next } = setup({
        method: "post",
        path: "/test",
        contentType: null,
        request: {
          body: {
            content: {
              "application/json": {
                schema: { type: "object" as const }
              }
            }
          }
        }
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      await middlewares[1](ctx, next);

      expect(ctx.json).toHaveBeenCalledWith({ error: "Content-Type header is required" }, 400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("when given config with additionalContentTypes", () => {
    it("accepts additional content types", async () => {
      const { route, ctx, next } = setup({
        method: "post",
        path: "/test",
        contentType: "text/yaml",
        additionalContentTypes: ["text/yaml"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: { type: "object" as const }
              }
            }
          }
        }
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      await middlewares[1](ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.json).not.toHaveBeenCalled();
    });
  });

  describe("when given config with pre-existing middleware", () => {
    it("appends existing middleware after generated middleware", () => {
      const existingMiddleware = jest.fn() as unknown as MiddlewareHandler;
      const { route } = setup({
        method: "get",
        path: "/test",
        middleware: [existingMiddleware]
      });

      const middlewares = route.middleware as MiddlewareHandler[];
      expect(middlewares).toHaveLength(2);
      expect(middlewares[1]).toBe(existingMiddleware);
    });
  });

  function setup(input: {
    method: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
    path: string;
    cache?: { maxAge: number; staleWhileRevalidate?: number };
    bodyLimit?: { maxSize: number };
    additionalContentTypes?: string[];
    request?: {
      body?: {
        content: Record<string, { schema: { type: "object" } }>;
      };
    };
    middleware?: MiddlewareHandler[];
    contentType?: string | null;
    currentUser?: { userId: string };
  }) {
    const mockAuthService = mock<AuthService>({
      safeCurrentUser: input.currentUser
    });
    container.registerInstance(AuthService, mockAuthService);

    const route = createRoute({
      method: input.method,
      path: input.path,
      summary: "Test",
      tags: ["Test"],
      security: SECURITY_NONE,
      cache: input.cache,
      bodyLimit: input.bodyLimit,
      additionalContentTypes: input.additionalContentTypes,
      request: input.request,
      middleware: input.middleware,
      responses: {
        200: { description: "OK" }
      }
    });

    const responseHeaders = new Map<string, string>();

    const ctx = mock<Context>({
      req: {
        method: "GET",
        header: (name: string) => {
          if (name === "Content-Type") {
            if (input.contentType === null) {
              return undefined;
            }
            return input.contentType ?? "application/json";
          }
          return undefined;
        }
      } as Context["req"],
      res: {
        status: 200,
        headers: {
          get: (name: string) => responseHeaders.get(name) ?? null
        }
      } as unknown as Context["res"]
    });

    ctx.header.mockImplementation((name: string, value?: string) => {
      if (value !== undefined) {
        responseHeaders.set(name, value);
      }
    });

    const next = jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<Next>;

    const getHeader = (name: string) => responseHeaders.get(name);

    return { route, ctx, next, getHeader };
  }
});
