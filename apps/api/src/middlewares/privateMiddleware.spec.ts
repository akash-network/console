import { faker } from "@faker-js/faker";
import { Hono } from "hono";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { INTERNAL_TOKEN_HEADER } from "./internal-token/internal-token.middleware";
import { requirePrivateToken } from "./privateMiddleware";

const GUARDED_PATH = "/guarded";
const GUARDED_BODY = "reached the handler";

describe(requirePrivateToken.name, () => {
  const configuredToken = generateToken();

  it("lets the request through when the header matches the configured token", async () => {
    const { request } = setup({ configuredToken });

    const response = await request({ headers: { [INTERNAL_TOKEN_HEADER]: configuredToken } });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
  });

  it.each<{ label: string; configured: boolean; path?: string; headers?: Record<string, string> }>([
    { label: "a mismatched header", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } },
    { label: "a header of a different length", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: `${generateToken()}${generateToken()}` } },
    { label: "an empty header", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: "" } },
    { label: "the configured token in the query string", configured: true, path: `${GUARDED_PATH}?token=${configuredToken}` },
    { label: "a missing token", configured: true },
    { label: "a header when no token is configured", configured: false, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } }
  ])("rejects $label", async ({ configured, path, headers }) => {
    const { request } = setup({ configuredToken: configured ? configuredToken : undefined });

    const response = await request({ path, headers });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  function setup(input: { configuredToken?: string }) {
    container.registerInstance(CORE_CONFIG, mock<CoreConfig>({ SECRET_TOKEN: input.configuredToken }));

    const app = new Hono();
    app.use(GUARDED_PATH, requirePrivateToken);
    app.get(GUARDED_PATH, c => c.text(GUARDED_BODY));

    return {
      request: (init: { path?: string; headers?: Record<string, string> } = {}) => app.request(init.path ?? GUARDED_PATH, { headers: init.headers ?? {} })
    };
  }
});

function generateToken() {
  return faker.string.alphanumeric(32);
}
