import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults to the support mailbox and 3 requests an hour, 10 a day", () => {
    expect(envSchema.parse({})).toEqual({
      HARDWARE_REQUEST_EMAIL: "support@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 3,
      HARDWARE_REQUEST_DAILY_LIMIT: 10
    });
  });

  it("reads the mailbox and limits from the environment", () => {
    expect(envSchema.parse({ HARDWARE_REQUEST_EMAIL: "sales@akash.network", HARDWARE_REQUEST_HOURLY_LIMIT: "5", HARDWARE_REQUEST_DAILY_LIMIT: "20" })).toEqual({
      HARDWARE_REQUEST_EMAIL: "sales@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 5,
      HARDWARE_REQUEST_DAILY_LIMIT: 20
    });
  });

  it.each([{ HARDWARE_REQUEST_EMAIL: "not-an-email" }, { HARDWARE_REQUEST_HOURLY_LIMIT: "0" }, { HARDWARE_REQUEST_DAILY_LIMIT: "1.5" }])("rejects %o", env => {
    expect(envSchema.safeParse(env).success).toBe(false);
  });
});
