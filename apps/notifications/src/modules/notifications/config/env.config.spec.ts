import { describe, expect, it } from "vitest";

import { schema } from "./env.config";

describe("notifications env config", () => {
  it("boots without the console-api settings the activity feed needs", () => {
    const config = schema.parse(requiredEnv());

    expect(config).toEqual({ ...requiredEnv(), CONSOLE_API_TIMEOUT_MS: 2000 });
  });

  it("takes empty console-api settings for unset ones", () => {
    const config = schema.parse({ ...requiredEnv(), CONSOLE_API_BASE_URL: "", CONSOLE_API_INTERNAL_TOKEN: "" });

    expect(config.CONSOLE_API_BASE_URL).toBeUndefined();
    expect(config.CONSOLE_API_INTERNAL_TOKEN).toBeUndefined();
  });

  it("keeps the console-api settings once they are set", () => {
    const config = schema.parse({
      ...requiredEnv(),
      CONSOLE_API_BASE_URL: "http://console-api:3080",
      CONSOLE_API_INTERNAL_TOKEN: "internal-token",
      CONSOLE_API_TIMEOUT_MS: "500"
    });

    expect(config).toMatchObject({
      CONSOLE_API_BASE_URL: "http://console-api:3080",
      CONSOLE_API_INTERNAL_TOKEN: "internal-token",
      CONSOLE_API_TIMEOUT_MS: 500
    });
  });

  it("refuses a console-api base url that is not a url", () => {
    expect(schema.safeParse({ ...requiredEnv(), CONSOLE_API_BASE_URL: "console-api" }).success).toBe(false);
  });

  function requiredEnv() {
    return { NOVU_SECRET_KEY: "novu-secret", NOVU_MAILER_WORKFLOW_ID: "mailer" };
  }
});
