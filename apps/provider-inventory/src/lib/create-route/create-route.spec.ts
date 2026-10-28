import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";

import { createRoute } from "./create-route";

describe(createRoute.name, () => {
  it("refuses a body larger than the route's limit", async () => {
    const { request } = setup({ bodyLimit: { maxSize: 32 } });

    const response = await request({ text: "x".repeat(64) });

    expect(response.status).toBe(413);
  });

  it("accepts a body within the route's limit", async () => {
    const { request } = setup({ bodyLimit: { maxSize: 64 } });

    const response = await request({ text: "x" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ length: 1 });
  });

  it("leaves the body unlimited when the route sets no limit", async () => {
    const { request } = setup({});

    const response = await request({ text: "x".repeat(64 * 1024) });

    expect(response.status).toBe(200);
  });

  it("keeps the route's own middleware behind the limit", async () => {
    const routeMiddleware = vi.fn<MiddlewareHandler>(async (_, next) => await next());
    const { request } = setup({ bodyLimit: { maxSize: 32 }, middleware: routeMiddleware });

    await request({ text: "x".repeat(64) });
    await request({ text: "x" });

    expect(routeMiddleware).toHaveBeenCalledTimes(1);
  });

  function setup(input: { bodyLimit?: { maxSize: number }; middleware?: MiddlewareHandler }) {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: "post",
      path: "/echo",
      bodyLimit: input.bodyLimit,
      middleware: input.middleware,
      request: { body: { content: { "application/json": { schema: z.object({ text: z.string() }) } } } },
      responses: { 200: { description: "Echoes the text length" } }
    });
    app.openapi(route, c => c.json({ length: c.req.valid("json").text.length }, 200));

    const request = (body: { text: string }) => {
      const json = JSON.stringify(body);
      return app.request("/echo", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(json.length) }, body: json });
    };

    return { app, request };
  }
});
