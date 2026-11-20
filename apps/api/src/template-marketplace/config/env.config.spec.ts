import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults to hourly limits on creating and saving and daily limits on publishing and reporting", () => {
    expect(envSchema.parse({})).toEqual({
      TEMPLATE_CREATE_LIMIT_PER_USER: 20,
      TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: 60,
      TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: 3600,
      TEMPLATE_VERSION_LIMIT_PER_USER: 60,
      TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: 180,
      TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: 3600,
      TEMPLATE_PUBLISH_LIMIT_PER_USER: 10,
      TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: 30,
      TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: 86400,
      TEMPLATE_REPORT_LIMIT_PER_USER: 10,
      TEMPLATE_REPORT_LIMIT_PER_ORGANIZATION: 30,
      TEMPLATE_REPORT_LIMIT_WINDOW_SECONDS: 86400,
      TEMPLATE_POPULAR_WEEKLY_DEPLOYERS: 25,
      TEMPLATE_IMAGE_WATCH_MAX_TEMPLATES: 200,
      TEMPLATE_IMAGE_WATCH_INTERVAL_SECONDS: 21600,
      TEMPLATE_SCORE_RECOMPUTE_INTERVAL_SECONDS: 3600,
      TEMPLATE_SCORE_MAX_TEMPLATES: 2000,
      TEMPLATE_SCORE_TRIAL_WEIGHT: 0.25,
      TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS: 30,
      TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: 180,
      TEMPLATE_SCORE_TRENDING_WINDOW_DAYS: 7,
      TEMPLATE_SCORE_TRENDING_MIN_VOLUME: 5,
      TEMPLATE_TRENDING_ROW_MIN_TEMPLATES: 4
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
        TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: "9",
        TEMPLATE_REPORT_LIMIT_PER_USER: "10",
        TEMPLATE_REPORT_LIMIT_PER_ORGANIZATION: "11",
        TEMPLATE_REPORT_LIMIT_WINDOW_SECONDS: "12",
        TEMPLATE_POPULAR_WEEKLY_DEPLOYERS: "13",
        TEMPLATE_IMAGE_WATCH_MAX_TEMPLATES: "14",
        TEMPLATE_IMAGE_WATCH_INTERVAL_SECONDS: "15",
        TEMPLATE_SCORE_RECOMPUTE_INTERVAL_SECONDS: "16",
        TEMPLATE_SCORE_MAX_TEMPLATES: "17",
        TEMPLATE_SCORE_TRIAL_WEIGHT: "0.5",
        TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS: "18",
        TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: "19",
        TEMPLATE_SCORE_TRENDING_WINDOW_DAYS: "20",
        TEMPLATE_SCORE_TRENDING_MIN_VOLUME: "21",
        TEMPLATE_TRENDING_ROW_MIN_TEMPLATES: "22"
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
      TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: 9,
      TEMPLATE_REPORT_LIMIT_PER_USER: 10,
      TEMPLATE_REPORT_LIMIT_PER_ORGANIZATION: 11,
      TEMPLATE_REPORT_LIMIT_WINDOW_SECONDS: 12,
      TEMPLATE_POPULAR_WEEKLY_DEPLOYERS: 13,
      TEMPLATE_IMAGE_WATCH_MAX_TEMPLATES: 14,
      TEMPLATE_IMAGE_WATCH_INTERVAL_SECONDS: 15,
      TEMPLATE_SCORE_RECOMPUTE_INTERVAL_SECONDS: 16,
      TEMPLATE_SCORE_MAX_TEMPLATES: 17,
      TEMPLATE_SCORE_TRIAL_WEIGHT: 0.5,
      TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS: 18,
      TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: 19,
      TEMPLATE_SCORE_TRENDING_WINDOW_DAYS: 20,
      TEMPLATE_SCORE_TRENDING_MIN_VOLUME: 21,
      TEMPLATE_TRENDING_ROW_MIN_TEMPLATES: 22
    });
  });

  it.each(["", "   "])("falls back to the default for a limit set to %j", blank => {
    expect(envSchema.parse({ TEMPLATE_CREATE_LIMIT_PER_USER: blank }).TEMPLATE_CREATE_LIMIT_PER_USER).toBe(20);
  });

  it("accepts a window of up to 366 days and refuses a longer one, which the database could not count back", () => {
    const longestWindowSeconds = 366 * 24 * 60 * 60;

    expect(envSchema.parse({ TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: String(longestWindowSeconds) }).TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS).toBe(
      longestWindowSeconds
    );
    expect(() => envSchema.parse({ TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: String(longestWindowSeconds + 1) })).toThrow();
    expect(() => envSchema.parse({ TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: "10000000000000" })).toThrow();
    expect(() => envSchema.parse({ TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: "10000000000000" })).toThrow();
    expect(() => envSchema.parse({ TEMPLATE_REPORT_LIMIT_WINDOW_SECONDS: "10000000000000" })).toThrow();
  });

  it.each(["", "   "])("falls back to the default for a window set to %j", blank => {
    expect(envSchema.parse({ TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: blank }).TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS).toBe(3600);
  });

  it.each(["0", "-1", "1.5", "many"])("refuses %j as a window", value => {
    expect(() => envSchema.parse({ TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: value })).toThrow();
  });

  it.each(["0", "-1", "1.5", "many"])("refuses %j as a limit", value => {
    expect(() => envSchema.parse({ TEMPLATE_PUBLISH_LIMIT_PER_USER: value })).toThrow();
  });

  it.each(["0", "0.1", "1"])("accepts %j as the weight of a trial user", value => {
    expect(envSchema.parse({ TEMPLATE_SCORE_TRIAL_WEIGHT: value }).TEMPLATE_SCORE_TRIAL_WEIGHT).toBe(Number(value));
  });

  it.each(["-0.1", "1.01", "half"])("refuses %j as the weight of a trial user, who never counts for more than a paying one", value => {
    expect(() => envSchema.parse({ TEMPLATE_SCORE_TRIAL_WEIGHT: value })).toThrow();
  });

  it.each(["", "   "])("falls back to the default for a trial weight or a score window set to %j", blank => {
    expect(envSchema.parse({ TEMPLATE_SCORE_TRIAL_WEIGHT: blank, TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: blank })).toMatchObject({
      TEMPLATE_SCORE_TRIAL_WEIGHT: 0.25,
      TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: 180
    });
  });

  it.each(["TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS", "TEMPLATE_SCORE_POPULAR_WINDOW_DAYS", "TEMPLATE_SCORE_TRENDING_WINDOW_DAYS"])(
    "accepts 1 to 366 whole days for %s",
    name => {
      expect(envSchema.parse({ [name]: "1" })).toMatchObject({ [name]: 1 });
      expect(envSchema.parse({ [name]: "366" })).toMatchObject({ [name]: 366 });
      expect(() => envSchema.parse({ [name]: "367" })).toThrow();
      expect(() => envSchema.parse({ [name]: "0" })).toThrow();
      expect(() => envSchema.parse({ [name]: "1.5" })).toThrow();
    }
  );
});
