import { describe, expect, it } from "vitest";

import { DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS } from "../lib/feedback-theme-score/feedback-theme-score";
import { envSchema, MAX_FEEDBACK_RETENTION_DAYS } from "./env.config";

describe("envSchema", () => {
  it("defaults to the public AkashML endpoint, no key, the default models and the default weights", () => {
    expect(envSchema.parse({})).toEqual({
      AKASHML_API_URL: "https://api.akashml.com/v1",
      AKASHML_API_KEY: undefined,
      FEEDBACK_CLASSIFIER_MODEL: "Qwen/Qwen3.6-35B-A3B",
      FEEDBACK_CLASSIFIER_ENGINE: "akashml",
      TYPESAFE_API_URL: "https://api.typesafe.ai",
      TYPESAFE_API_KEY: undefined,
      FEEDBACK_JEV_MODEL: "jev-1.14.0",
      ASSISTANT_MODEL: "zai-org/GLM-5.3",
      ASSISTANT_REASONING_EFFORT: "medium",
      FEEDBACK_THEME_SCORE_WEIGHTS: DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS,
      ASSISTANT_MESSAGES_PER_MINUTE: 6,
      ASSISTANT_MESSAGES_PER_DAY: 100,
      ASSISTANT_TRIAL_MESSAGES_PER_DAY: 15,
      ASSISTANT_TRIAL_TOTAL_MESSAGES: 50,
      ASSISTANT_USER_DAILY_TOKENS: 2_000_000,
      ASSISTANT_TRIAL_USER_DAILY_TOKENS: 500_000,
      ASSISTANT_DAILY_TOKEN_BUDGET: 20_000_000,
      ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: 5_000_000,
      FEEDBACK_RETENTION_DAYS: 365,
      ASSISTANT_DAILY_FLAGGED_TURN_LIMIT: 3,
      ASSISTANT_SUPPORT_URL: "https://discord.gg/akash",
      ASSISTANT_HISTORY_SIGNING_KEY: undefined,
      ASSISTANT_SLACK_WEBHOOK_URL: undefined
    });
  });

  it("treats blank values as unset", () => {
    expect(
      envSchema.parse({
        AKASHML_API_URL: "",
        AKASHML_API_KEY: "",
        FEEDBACK_CLASSIFIER_MODEL: "",
        FEEDBACK_CLASSIFIER_ENGINE: "",
        TYPESAFE_API_URL: "",
        TYPESAFE_API_KEY: "",
        FEEDBACK_JEV_MODEL: "",
        ASSISTANT_MODEL: "",
        ASSISTANT_REASONING_EFFORT: "",
        FEEDBACK_THEME_SCORE_WEIGHTS: "",
        ASSISTANT_MESSAGES_PER_MINUTE: "",
        ASSISTANT_MESSAGES_PER_DAY: "",
        ASSISTANT_TRIAL_MESSAGES_PER_DAY: "",
        ASSISTANT_TRIAL_TOTAL_MESSAGES: "",
        ASSISTANT_USER_DAILY_TOKENS: "",
        ASSISTANT_TRIAL_USER_DAILY_TOKENS: "",
        ASSISTANT_DAILY_TOKEN_BUDGET: "",
        ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "",
        FEEDBACK_RETENTION_DAYS: "",
        ASSISTANT_DAILY_FLAGGED_TURN_LIMIT: "",
        ASSISTANT_SUPPORT_URL: "",
        ASSISTANT_HISTORY_SIGNING_KEY: "",
        ASSISTANT_SLACK_WEBHOOK_URL: ""
      })
    ).toEqual(envSchema.parse({}));
  });

  it("reads the endpoint, key, models and weight overrides from the environment", () => {
    expect(
      envSchema.parse({
        AKASHML_API_URL: "https://akashml.example.com/v1",
        AKASHML_API_KEY: "test-key",
        FEEDBACK_CLASSIFIER_MODEL: "classifier-model",
        FEEDBACK_CLASSIFIER_ENGINE: "jev",
        TYPESAFE_API_URL: "https://typesafe.example.com",
        TYPESAFE_API_KEY: "typesafe-key",
        FEEDBACK_JEV_MODEL: "jev-model",
        ASSISTANT_MODEL: "assistant-model",
        ASSISTANT_REASONING_EFFORT: "low",
        FEEDBACK_THEME_SCORE_WEIGHTS: '{"payingUser":3,"recencyHalfLifeDays":7}',
        ASSISTANT_MESSAGES_PER_MINUTE: "3",
        ASSISTANT_MESSAGES_PER_DAY: "50",
        ASSISTANT_TRIAL_MESSAGES_PER_DAY: "10",
        ASSISTANT_TRIAL_TOTAL_MESSAGES: "40",
        ASSISTANT_USER_DAILY_TOKENS: "4000",
        ASSISTANT_TRIAL_USER_DAILY_TOKENS: "2000",
        ASSISTANT_DAILY_TOKEN_BUDGET: "1000",
        ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "300",
        FEEDBACK_RETENTION_DAYS: "30",
        ASSISTANT_DAILY_FLAGGED_TURN_LIMIT: "5",
        ASSISTANT_SUPPORT_URL: "https://support.example.com",
        ASSISTANT_HISTORY_SIGNING_KEY: "k".repeat(32),
        ASSISTANT_SLACK_WEBHOOK_URL: "https://hooks.slack.example.com/services/assistant"
      })
    ).toEqual({
      AKASHML_API_URL: "https://akashml.example.com/v1",
      AKASHML_API_KEY: "test-key",
      FEEDBACK_CLASSIFIER_MODEL: "classifier-model",
      FEEDBACK_CLASSIFIER_ENGINE: "jev",
      TYPESAFE_API_URL: "https://typesafe.example.com",
      TYPESAFE_API_KEY: "typesafe-key",
      FEEDBACK_JEV_MODEL: "jev-model",
      ASSISTANT_MODEL: "assistant-model",
      ASSISTANT_REASONING_EFFORT: "low",
      FEEDBACK_THEME_SCORE_WEIGHTS: { ...DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, payingUser: 3, recencyHalfLifeDays: 7 },
      ASSISTANT_MESSAGES_PER_MINUTE: 3,
      ASSISTANT_MESSAGES_PER_DAY: 50,
      ASSISTANT_TRIAL_MESSAGES_PER_DAY: 10,
      ASSISTANT_TRIAL_TOTAL_MESSAGES: 40,
      ASSISTANT_USER_DAILY_TOKENS: 4000,
      ASSISTANT_TRIAL_USER_DAILY_TOKENS: 2000,
      ASSISTANT_DAILY_TOKEN_BUDGET: 1000,
      ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: 300,
      FEEDBACK_RETENTION_DAYS: 30,
      ASSISTANT_DAILY_FLAGGED_TURN_LIMIT: 5,
      ASSISTANT_SUPPORT_URL: "https://support.example.com",
      ASSISTANT_HISTORY_SIGNING_KEY: "k".repeat(32),
      ASSISTANT_SLACK_WEBHOOK_URL: "https://hooks.slack.example.com/services/assistant"
    });
  });

  it("accepts weight overrides that are already parsed", () => {
    expect(envSchema.parse({ FEEDBACK_THEME_SCORE_WEIGHTS: { lowRating: 0 } }).FEEDBACK_THEME_SCORE_WEIGHTS).toEqual({
      ...DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS,
      lowRating: 0
    });
  });

  it("accepts a retention of exactly the maximum number of days", () => {
    expect(envSchema.parse({ FEEDBACK_RETENTION_DAYS: String(MAX_FEEDBACK_RETENTION_DAYS) }).FEEDBACK_RETENTION_DAYS).toBe(MAX_FEEDBACK_RETENTION_DAYS);
  });

  it.each([
    { AKASHML_API_URL: "not-a-url" },
    { TYPESAFE_API_URL: "not-a-url" },
    { FEEDBACK_CLASSIFIER_ENGINE: "openai" },
    { ASSISTANT_SUPPORT_URL: "not-a-url" },
    { ASSISTANT_MESSAGES_PER_MINUTE: "0" },
    { ASSISTANT_MESSAGES_PER_DAY: "1.5" },
    { ASSISTANT_USER_DAILY_TOKENS: "0" },
    { ASSISTANT_TRIAL_USER_DAILY_TOKENS: "-1" },
    { ASSISTANT_TRIAL_TOTAL_MESSAGES: "0" },
    { ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "2.5" },
    { FEEDBACK_RETENTION_DAYS: "0" },
    { FEEDBACK_RETENTION_DAYS: "90.5" },
    { FEEDBACK_RETENTION_DAYS: String(MAX_FEEDBACK_RETENTION_DAYS + 1) },
    { FEEDBACK_RETENTION_DAYS: "1000000000" },
    { ASSISTANT_DAILY_FLAGGED_TURN_LIMIT: "0" },
    { ASSISTANT_REASONING_EFFORT: "none" },
    { ASSISTANT_HISTORY_SIGNING_KEY: "k".repeat(31) },
    { FEEDBACK_THEME_SCORE_WEIGHTS: "{not json" },
    { FEEDBACK_THEME_SCORE_WEIGHTS: '{"unknownWeight":1}' },
    { FEEDBACK_THEME_SCORE_WEIGHTS: '{"payingUser":-1}' },
    { FEEDBACK_THEME_SCORE_WEIGHTS: '{"recencyHalfLifeDays":0}' }
  ])("rejects %o", env => {
    expect(envSchema.safeParse(env).success).toBe(false);
  });

  it.each([
    { ASSISTANT_DAILY_TOKEN_BUDGET: "1000", ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "1000" },
    { ASSISTANT_DAILY_TOKEN_BUDGET: "1000", ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "1001" }
  ])("rejects a trial token budget that is not below the shared one: %o", env => {
    const result = envSchema.safeParse(env);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET"],
        message: `ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET (${env.ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET}) must be below ASSISTANT_DAILY_TOKEN_BUDGET (1000), otherwise trial accounts can spend the whole shared budget`
      })
    ]);
  });

  it("accepts a trial token budget just below the shared one", () => {
    expect(envSchema.parse({ ASSISTANT_DAILY_TOKEN_BUDGET: "1000", ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET: "999" }).ASSISTANT_TRIAL_DAILY_TOKEN_BUDGET).toBe(999);
  });
});
