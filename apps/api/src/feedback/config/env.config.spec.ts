import { describe, expect, it } from "vitest";

import { DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS } from "../lib/feedback-theme-score/feedback-theme-score";
import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults to the public AkashML endpoint, no key, the default models and the default weights", () => {
    expect(envSchema.parse({})).toEqual({
      AKASHML_API_URL: "https://api.akashml.com/v1",
      AKASHML_API_KEY: undefined,
      FEEDBACK_CLASSIFIER_MODEL: "Qwen/Qwen3.5-35B-A3B",
      ASSISTANT_MODEL: "deepseek-ai/DeepSeek-V4-Flash",
      FEEDBACK_THEME_SCORE_WEIGHTS: DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS
    });
  });

  it("treats blank values as unset", () => {
    expect(
      envSchema.parse({ AKASHML_API_URL: "", AKASHML_API_KEY: "", FEEDBACK_CLASSIFIER_MODEL: "", ASSISTANT_MODEL: "", FEEDBACK_THEME_SCORE_WEIGHTS: "" })
    ).toEqual(envSchema.parse({}));
  });

  it("reads the endpoint, key, models and weight overrides from the environment", () => {
    expect(
      envSchema.parse({
        AKASHML_API_URL: "https://akashml.example.com/v1",
        AKASHML_API_KEY: "test-key",
        FEEDBACK_CLASSIFIER_MODEL: "classifier-model",
        ASSISTANT_MODEL: "assistant-model",
        FEEDBACK_THEME_SCORE_WEIGHTS: '{"payingUser":3,"recencyHalfLifeDays":7}'
      })
    ).toEqual({
      AKASHML_API_URL: "https://akashml.example.com/v1",
      AKASHML_API_KEY: "test-key",
      FEEDBACK_CLASSIFIER_MODEL: "classifier-model",
      ASSISTANT_MODEL: "assistant-model",
      FEEDBACK_THEME_SCORE_WEIGHTS: { ...DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS, payingUser: 3, recencyHalfLifeDays: 7 }
    });
  });

  it("accepts weight overrides that are already parsed", () => {
    expect(envSchema.parse({ FEEDBACK_THEME_SCORE_WEIGHTS: { lowRating: 0 } }).FEEDBACK_THEME_SCORE_WEIGHTS).toEqual({
      ...DEFAULT_FEEDBACK_THEME_SCORE_WEIGHTS,
      lowRating: 0
    });
  });

  it.each([
    { AKASHML_API_URL: "not-a-url" },
    { FEEDBACK_THEME_SCORE_WEIGHTS: "{not json" },
    { FEEDBACK_THEME_SCORE_WEIGHTS: '{"unknownWeight":1}' },
    { FEEDBACK_THEME_SCORE_WEIGHTS: '{"payingUser":-1}' },
    { FEEDBACK_THEME_SCORE_WEIGHTS: '{"recencyHalfLifeDays":0}' }
  ])("rejects %o", env => {
    expect(envSchema.safeParse(env).success).toBe(false);
  });
});
