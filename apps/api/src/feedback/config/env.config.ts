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

function positiveIntegerOr(fallback: number) {
  return z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional().default(fallback));
}

export const envSchema = z.object({
  AKASHML_API_URL: z.preprocess(blankToUndefined, z.string().url().optional().default("https://api.akashml.com/v1")),
  AKASHML_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  FEEDBACK_CLASSIFIER_MODEL: z.preprocess(blankToUndefined, z.string().optional().default("Qwen/Qwen3.6-35B-A3B")),
  FEEDBACK_CLASSIFIER_ENGINE: z.preprocess(blankToUndefined, z.enum(["akashml", "jev"]).optional().default("akashml")),
  TYPESAFE_API_URL: z.preprocess(blankToUndefined, z.string().url().optional().default("https://api.typesafe.ai")),
  TYPESAFE_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  FEEDBACK_JEV_MODEL: z.preprocess(blankToUndefined, z.string().optional().default("jev-1.14.0")),
  ASSISTANT_MODEL: z.preprocess(blankToUndefined, z.string().optional().default("zai-org/GLM-5.3")),
  ASSISTANT_REASONING_EFFORT: z.preprocess(blankToUndefined, z.enum(["low", "medium", "high"]).optional().default("medium")),
  FEEDBACK_THEME_SCORE_WEIGHTS: z.preprocess(parseJson, feedbackThemeScoreWeightsSchema),
  ASSISTANT_MESSAGES_PER_MINUTE: positiveIntegerOr(6),
  ASSISTANT_MESSAGES_PER_DAY: positiveIntegerOr(100),
  ASSISTANT_TRIAL_MESSAGES_PER_DAY: positiveIntegerOr(30),
  ASSISTANT_DAILY_TOKEN_BUDGET: positiveIntegerOr(20_000_000),
  ASSISTANT_SUPPORT_URL: z.preprocess(blankToUndefined, z.string().url().optional().default("https://discord.gg/akash")),
  ASSISTANT_HISTORY_SIGNING_KEY: z.preprocess(blankToUndefined, z.string().min(32).optional())
});

export type FeedbackConfig = z.infer<typeof envSchema>;
