import { describe, expect, it } from "vitest";

import { schema } from "./env.config";

describe("notifications env config", () => {
  it("boots without the console-api settings the activity feed needs", () => {
    const config = schema.parse(requiredEnv());

    expect(config).toEqual({ ...requiredEnv(), SENDGRID_API_BASE_URL: "https://api.sendgrid.com", SENDGRID_TIMEOUT_MS: 10_000, CONSOLE_API_TIMEOUT_MS: 2000 });
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

  it("takes an empty promotional email postal address for an unset one", () => {
    const config = schema.parse({ ...requiredEnv(), PROMOTIONAL_EMAIL_POSTAL_ADDRESS: "" });

    expect(config.PROMOTIONAL_EMAIL_POSTAL_ADDRESS).toBeUndefined();
  });

  it("keeps the promotional email postal address once it is set", () => {
    const config = schema.parse({ ...requiredEnv(), PROMOTIONAL_EMAIL_POSTAL_ADDRESS: "1 Market St, San Francisco, CA 94105" });

    expect(config.PROMOTIONAL_EMAIL_POSTAL_ADDRESS).toBe("1 Market St, San Francisco, CA 94105");
  });

  it("keeps the SendGrid settings once they are set", () => {
    const config = schema.parse({
      ...requiredEnv(),
      SENDGRID_API_BASE_URL: "https://api.eu.sendgrid.com",
      SENDGRID_TIMEOUT_MS: "3000",
      EMAIL_FROM_NAME: "Akash Console"
    });

    expect(config).toMatchObject({ SENDGRID_API_BASE_URL: "https://api.eu.sendgrid.com", SENDGRID_TIMEOUT_MS: 3000, EMAIL_FROM_NAME: "Akash Console" });
  });

  it("takes an empty sender name for an unset one", () => {
    const config = schema.parse({ ...requiredEnv(), EMAIL_FROM_NAME: "" });

    expect(config.EMAIL_FROM_NAME).toBeUndefined();
  });

  it.each([
    ["a sender address that is not an email", { EMAIL_FROM_ADDRESS: "akash console" }],
    ["a SendGrid base url that is not a url", { SENDGRID_API_BASE_URL: "sendgrid" }],
    ["a SendGrid timeout that is not positive", { SENDGRID_TIMEOUT_MS: "0" }]
  ])("refuses %s", (_, invalid) => {
    expect(schema.safeParse({ ...requiredEnv(), ...invalid }).success).toBe(false);
  });

  it.each(["SENDGRID_API_KEY", "EMAIL_FROM_ADDRESS"] as const)("refuses to boot without %s", key => {
    const { [key]: _, ...env } = requiredEnv();

    expect(schema.safeParse(env).success).toBe(false);
  });

  it.each(["SENDGRID_API_KEY", "EMAIL_FROM_ADDRESS"] as const)("refuses to boot with an empty %s", key => {
    expect(schema.safeParse({ ...requiredEnv(), [key]: "" }).success).toBe(false);
  });

  it("takes empty SendGrid base url and timeout for unset ones and falls back to their defaults", () => {
    const config = schema.parse({ ...requiredEnv(), SENDGRID_API_BASE_URL: "", SENDGRID_TIMEOUT_MS: "" });

    expect(config).toMatchObject({ SENDGRID_API_BASE_URL: "https://api.sendgrid.com", SENDGRID_TIMEOUT_MS: 10_000 });
  });

  function requiredEnv() {
    return { SENDGRID_API_KEY: "sendgrid-key", EMAIL_FROM_ADDRESS: "alerts@example.com" };
  }
});
