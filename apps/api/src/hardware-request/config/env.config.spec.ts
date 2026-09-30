import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults to the support mailbox and 3 requests an hour, 10 a day, with no Slack alert", () => {
    expect(envSchema.parse({})).toEqual({
      HARDWARE_REQUEST_EMAIL: "support@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 3,
      HARDWARE_REQUEST_DAILY_LIMIT: 10
    });
  });

  it("reads the mailbox, limits and Slack alert links from the environment", () => {
    expect(
      envSchema.parse({
        HARDWARE_REQUEST_EMAIL: "sales@akash.network",
        HARDWARE_REQUEST_HOURLY_LIMIT: "5",
        HARDWARE_REQUEST_DAILY_LIMIT: "20",
        HARDWARE_REQUEST_SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/T000/B000/hardware",
        AMPLITUDE_PROJECT_URL: "https://app.amplitude.com/analytics/example-org/project/100001",
        CONSOLE_ADMIN_URL: "https://console-admin.example.com"
      })
    ).toEqual({
      HARDWARE_REQUEST_EMAIL: "sales@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 5,
      HARDWARE_REQUEST_DAILY_LIMIT: 20,
      HARDWARE_REQUEST_SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/T000/B000/hardware",
      AMPLITUDE_PROJECT_URL: "https://app.amplitude.com/analytics/example-org/project/100001",
      CONSOLE_ADMIN_URL: "https://console-admin.example.com"
    });
  });

  it("treats blank Slack alert settings as unset", () => {
    const config = envSchema.parse({ HARDWARE_REQUEST_SLACK_WEBHOOK_URL: "", AMPLITUDE_PROJECT_URL: "", CONSOLE_ADMIN_URL: "" });

    expect(config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL).toBeUndefined();
    expect(config.AMPLITUDE_PROJECT_URL).toBeUndefined();
    expect(config.CONSOLE_ADMIN_URL).toBeUndefined();
  });

  it.each([
    { HARDWARE_REQUEST_EMAIL: "not-an-email" },
    { HARDWARE_REQUEST_HOURLY_LIMIT: "0" },
    { HARDWARE_REQUEST_DAILY_LIMIT: "1.5" },
    { HARDWARE_REQUEST_SLACK_WEBHOOK_URL: "not-a-url" }
  ])("rejects %o", env => {
    expect(envSchema.safeParse(env).success).toBe(false);
  });
});
