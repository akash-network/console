import { faker } from "@faker-js/faker";
import { Hono } from "hono";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { INTERNAL_TOKEN_HEADER, requireInternalToken } from "./internal-token.middleware";

const GUARDED_PATH = "/guarded";
const GUARDED_BODY = "reached the handler";

describe("requireInternalToken", () => {
  const configuredToken = generateToken();

  it("lets the request through when the header matches the configured token", async () => {
    const { request } = setup({ configuredToken });

    const response = await request({ headers: { [INTERNAL_TOKEN_HEADER]: configuredToken } });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
  });

  it("ignores the same token in the query string", async () => {
    const { request } = setup({ configuredToken });

    const response = await request({ path: `${GUARDED_PATH}?token=${configuredToken}` });

    expect(response.status).toBe(401);
  });

  it.each<{ label: string; configured: boolean; headers: Record<string, string> }>([
    { label: "a mismatched token", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } },
    { label: "a token of a different length", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: `${generateToken()}${generateToken()}` } },
    { label: "a missing header", configured: true, headers: {} },
    { label: "an empty header", configured: true, headers: { [INTERNAL_TOKEN_HEADER]: "" } },
    { label: "an unconfigured token", configured: false, headers: { [INTERNAL_TOKEN_HEADER]: generateToken() } },
    { label: "neither side configured", configured: false, headers: {} }
  ])("rejects $label", async ({ configured, headers }) => {
    const { request } = setup({ configuredToken: configured ? configuredToken : undefined });

    const response = await request({ headers });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  function setup(input: { configuredToken?: string }) {
    container.registerInstance(CORE_CONFIG, mock<CoreConfig>({ INTERNAL_API_TOKEN: input.configuredToken }));

    const app = new Hono();
    app.use(GUARDED_PATH, requireInternalToken);
    app.get(GUARDED_PATH, c => c.text(GUARDED_BODY));

    return {
      request: (init: { path?: string; headers?: Record<string, string> } = {}) => app.request(init.path ?? GUARDED_PATH, { headers: init.headers ?? {} })
    };
  }
});

function generateToken() {
  return faker.string.alphanumeric(32);
}
