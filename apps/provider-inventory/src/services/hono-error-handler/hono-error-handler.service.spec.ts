import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AppEnv } from "@src/types/app-context";
import { HonoErrorHandlerService } from "./hono-error-handler.service";

describe(HonoErrorHandlerService.name, () => {
  it("responds 400 with a validation error when the query string has a malformed percent escape", async () => {
    const { request } = setup();

    const response = await request("/echo-query?value=%ZZ");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "BadRequestError",
      message: "Malformed URI encoding",
      code: "validation_error",
      type: "validation_error"
    });
  });

  it("responds 500 with an internal server error for an unexpected error", async () => {
    const { request } = setup();

    const response = await request("/fail");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "InternalServerError",
      message: "Internal server error",
      code: "internal_server_error",
      type: "server_error"
    });
  });

  function setup() {
    const app = new Hono<AppEnv>();
    app.get("/echo-query", c => c.json({ value: c.req.query("value") }));
    app.get("/fail", () => {
      throw new Error("unexpected");
    });
    app.onError(new HonoErrorHandlerService().handle);

    return { request: (path: string) => app.request(path) };
  }
});
