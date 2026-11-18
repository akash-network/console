import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults to hourly limits on creating and saving and a daily limit on publishing", () => {
    expect(envSchema.parse({})).toEqual({
      TEMPLATE_CREATE_LIMIT_PER_USER: 20,
      TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: 60,
      TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: 3600,
      TEMPLATE_VERSION_LIMIT_PER_USER: 60,
      TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: 180,
      TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: 3600,
      TEMPLATE_PUBLISH_LIMIT_PER_USER: 10,
      TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: 30,
      TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: 86400
    });
  });

  it("reads every limit from the environment", () => {
    expect(
      envSchema.parse({
        TEMPLATE_CREATE_LIMIT_PER_USER: "1",
        TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: "2",
        TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: "3",
        TEMPLATE_VERSION_LIMIT_PER_USER: "4",
        TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: "5",
        TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: "6",
        TEMPLATE_PUBLISH_LIMIT_PER_USER: "7",
        TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: "8",
        TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: "9"
      })
    ).toEqual({
      TEMPLATE_CREATE_LIMIT_PER_USER: 1,
      TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: 2,
      TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: 3,
      TEMPLATE_VERSION_LIMIT_PER_USER: 4,
      TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: 5,
      TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: 6,
      TEMPLATE_PUBLISH_LIMIT_PER_USER: 7,
      TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: 8,
      TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: 9
    });
  });

  it.each(["", "   "])("falls back to the default for a limit set to %j", blank => {
    expect(envSchema.parse({ TEMPLATE_CREATE_LIMIT_PER_USER: blank }).TEMPLATE_CREATE_LIMIT_PER_USER).toBe(20);
  });

  it.each(["0", "-1", "1.5", "many"])("refuses %j as a limit", value => {
    expect(() => envSchema.parse({ TEMPLATE_PUBLISH_LIMIT_PER_USER: value })).toThrow();
  });
});
