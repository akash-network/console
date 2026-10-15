import { faker } from "@faker-js/faker";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import { LocalHttpLoggerMiddleware } from "./http-logger.middleware";

describe(LocalHttpLoggerMiddleware.name, () => {
  it("logs the organization a request was made in", () => {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();
    const { logger, finishRequest } = setup({ headers: { "x-user-id": userId, "x-organization-id": organizationId } });

    finishRequest();

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userId, organizationId }));
  });

  it("logs no organization for a request made outside one", () => {
    const userId = faker.string.uuid();
    const { logger, finishRequest } = setup({ headers: { "x-user-id": userId } });

    finishRequest();

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ userId, organizationId: null }));
  });

  it("logs only once the response is finished", () => {
    const { logger, next } = setup({ headers: {} });

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  function setup(input: { headers: Record<string, string> }) {
    const logger = mock<LoggerService>();
    const request = mock<Request>({ method: "POST", url: "/v1/alerts" });
    request.headers = input.headers;
    const response = mock<Response>({ statusCode: 201 });
    const next = vi.fn();

    new LocalHttpLoggerMiddleware(logger).use(request, response, next);

    const finishRequest = () => {
      const [, onFinish] = response.on.mock.calls.find(([event]) => event === "finish") ?? [];
      (onFinish as () => void)();
    };

    return { logger, next, finishRequest };
  }
});
