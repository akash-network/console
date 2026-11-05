import { z } from "zod";

import { feedbackThemeScoreWeightsSchema } from "../lib/feedback-theme-score/feedback-theme-score";

function blankToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string" || value === "") return blankToUndefined(value);

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const envSchema = z.object({
  AKASHML_API_URL: z.preprocess(blankToUndefined, z.string().url().optional().default("https://api.akashml.com/v1")),
  AKASHML_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  FEEDBACK_CLASSIFIER_MODEL: z.preprocess(blankToUndefined, z.string().optional().default("Qwen/Qwen3.5-35B-A3B")),
  ASSISTANT_MODEL: z.preprocess(blankToUndefined, z.string().optional().default("deepseek-ai/DeepSeek-V4-Flash")),
  FEEDBACK_THEME_SCORE_WEIGHTS: z.preprocess(parseJson, feedbackThemeScoreWeightsSchema)
});

export type FeedbackConfig = z.infer<typeof envSchema>;
