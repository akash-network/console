import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "../logger/logger.service";
import { HttpLoggerInterceptor } from "./http-logger.service";

describe(HttpLoggerInterceptor.name, () => {
  it("logs with info for 2xx responses", async () => {
    const { logger } = await setup({ status: 200 });

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ httpRequest: expect.objectContaining({ status: 200 }) }));
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs with info for 3xx responses", async () => {
    const { logger } = await setup({ status: 301 });

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ httpRequest: expect.objectContaining({ status: 301 }) }));
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs with warn for 4xx responses", async () => {
    const { logger } = await setup({ status: 404 });

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ httpRequest: expect.objectContaining({ status: 404 }) }));
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs with error for 5xx responses", async () => {
    const { logger } = await setup({ status: 500 });

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ httpRequest: expect.objectContaining({ status: 500 }) }));
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("includes request method and url in the log", async () => {
    const { logger } = await setup({ status: 200 });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        httpRequest: expect.objectContaining({
          requestMethod: "GET",
          requestUrl: expect.stringContaining("/test")
        })
      })
    );
  });

  it("includes duration in the log", async () => {
    const { logger } = await setup({ status: 200 });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        httpRequest: expect.objectContaining({
          duration: expect.stringMatching(/^\d+\.\d{3}ms$/)
        })
      })
    );
  });

  it("includes the auth method a later middleware recorded", async () => {
    const { logger } = await setup({ status: 401, authMethod: "api_key" });

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ authMethod: "api_key" }));
  });

  it("omits the auth method when none was recorded", async () => {
    const { logger } = await setup({ status: 200 });

    expect(logger.info.mock.calls[0][0]).not.toHaveProperty("authMethod");
  });

  async function setup(input: { status: number; authMethod?: string }) {
    const logger = mock<LoggerService>();

    const interceptor = new HttpLoggerInterceptor(logger);

    const app = new Hono<{ Variables: { authMethod?: string } }>();
    app.use(interceptor.intercept());
    app.use(async (c, next) => {
      c.set("authMethod", input.authMethod);
      await next();
    });
    app.get("/test", c => c.text("ok", input.status as 200));

    await app.request("/test");

    return { logger };
  }
});
