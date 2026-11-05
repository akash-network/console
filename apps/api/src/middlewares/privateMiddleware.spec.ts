import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { Hono } from "hono";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { INTERNAL_TOKEN_HEADER } from "./internal-token/internal-token.middleware";
import { requirePrivateToken } from "./privateMiddleware";

const GUARDED_PATH = "/guarded";
const GUARDED_BODY = "reached the handler";

describe(requirePrivateToken.name, () => {
  const configuredToken = generateToken();

  it("lets the request through when the header matches the configured token", async () => {
    const { request, logger } = setup({ configuredToken });

    const response = await request({ headers: { [INTERNAL_TOKEN_HEADER]: configuredToken } });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("lets the request through when the query string matches the configured token", async () => {
    const { request } = setup({ configuredToken });

    const response = await request({ path: `${GUARDED_PATH}?token=${configuredToken}` });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
  });

  it("reports the caller of a request that sent the token in the query string", async () => {
    const { request, createLogger, logger } = setup({ configuredToken });
    const userAgent = faker.internet.userAgent();

    await request({ path: `${GUARDED_PATH}?token=${configuredToken}`, headers: { "user-agent": userAgent } });

    expect(createLogger).toHaveBeenCalledWith({ context: "PrivateToken" });
    expect(logger.warn).toHaveBeenCalledWith({
      event: "PRIVATE_TOKEN_READ_FROM_QUERY_STRING",
      method: "GET",
      path: GUARDED_PATH,
      userAgent
    });
  });

  it("keeps the token out of every log record", async () => {
    const { request, createLogger, logger } = setup({ configuredToken });

    await request({ path: `${GUARDED_PATH}?token=${configuredToken}&page=1` });

    const records = [...createLogger.mock.calls, ...logger.debug.mock.calls, ...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls];
    expect(records).not.toHaveLength(0);
    expect(JSON.stringify(records)).not.toContain(configuredToken);
  });

  it("checks the header rather than the query string when both are sent", async () => {
    const { request, logger } = setup({ configuredToken });

    const response = await request({ path: `${GUARDED_PATH}?token=${configuredToken}`, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } });

    expect(response.status).toBe(401);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each<{ label: string; configured: boolean; path?: string; headers?: Record<string, string> }>([
    { label: "a mismatched header", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } },
    { label: "a header of a different length", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: `${generateToken()}${generateToken()}` } },
    { label: "an empty header", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: "" } },
    { label: "a mismatched query string token", configured: true, path: `${GUARDED_PATH}?token=${generateToken()}` },
    { label: "a missing token", configured: true },
    { label: "a header when no token is configured", configured: false, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } },
    { label: "a query string token when no token is configured", configured: false, path: `${GUARDED_PATH}?token=${generateToken()}` }
  ])("rejects $label", async ({ configured, path, headers }) => {
    const { request, logger } = setup({ configuredToken: configured ? configuredToken : undefined });

    const response = await request({ path, headers });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  function setup(input: { configuredToken?: string }) {
    const logger = mock<LoggerService>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    container.registerInstance(CORE_CONFIG, mock<CoreConfig>({ SECRET_TOKEN: input.configuredToken }));
    container.registerInstance(LOGGER_FACTORY, createLogger);

    const app = new Hono();
    app.use(GUARDED_PATH, requirePrivateToken);
    app.get(GUARDED_PATH, c => c.text(GUARDED_BODY));

    return {
      logger,
      createLogger,
      request: (init: { path?: string; headers?: Record<string, string> } = {}) => app.request(init.path ?? GUARDED_PATH, { headers: init.headers ?? {} })
    };
  }
});

function generateToken() {
  return faker.string.alphanumeric(32);
}
