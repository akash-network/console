import { z } from "zod";

function blankToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function positiveInteger(fallback: number) {
  return z.preprocess(blankToUndefined, z.number({ coerce: true }).int().positive().default(fallback));
}

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const MAX_WINDOW_SECONDS = 366 * DAY_SECONDS;

function windowSeconds(fallback: number) {
  return z.preprocess(blankToUndefined, z.number({ coerce: true }).int().positive().max(MAX_WINDOW_SECONDS).default(fallback));
}

const MAX_SCORE_WINDOW_DAYS = 366;

function days(fallback: number) {
  return z.preprocess(blankToUndefined, z.number({ coerce: true }).int().positive().max(MAX_SCORE_WINDOW_DAYS).default(fallback));
}

function share(fallback: number) {
  return z.preprocess(blankToUndefined, z.number({ coerce: true }).min(0).max(1).default(fallback));
}

export const envSchema = z.object({
  TEMPLATE_CREATE_LIMIT_PER_USER: positiveInteger(20),
  TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: positiveInteger(60),
  TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: windowSeconds(HOUR_SECONDS),
  TEMPLATE_VERSION_LIMIT_PER_USER: positiveInteger(60),
  TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: positiveInteger(180),
  TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: windowSeconds(HOUR_SECONDS),
  TEMPLATE_PUBLISH_LIMIT_PER_USER: positiveInteger(10),
  TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: positiveInteger(30),
  TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: windowSeconds(DAY_SECONDS),
  TEMPLATE_REPORT_LIMIT_PER_USER: positiveInteger(10),
  TEMPLATE_REPORT_LIMIT_PER_ORGANIZATION: positiveInteger(30),
  TEMPLATE_REPORT_LIMIT_WINDOW_SECONDS: windowSeconds(DAY_SECONDS),
  TEMPLATE_POPULAR_WEEKLY_DEPLOYERS: positiveInteger(25),
  TEMPLATE_IMAGE_WATCH_MAX_TEMPLATES: positiveInteger(200),
  TEMPLATE_IMAGE_WATCH_INTERVAL_SECONDS: windowSeconds(6 * HOUR_SECONDS),
  TEMPLATE_SCORE_RECOMPUTE_INTERVAL_SECONDS: windowSeconds(HOUR_SECONDS),
  TEMPLATE_SCORE_MAX_TEMPLATES: positiveInteger(2000),
  TEMPLATE_SCORE_TRIAL_WEIGHT: share(0.25),
  TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS: days(30),
  TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: days(180),
  TEMPLATE_SCORE_TRENDING_WINDOW_DAYS: days(7),
  TEMPLATE_SCORE_TRENDING_MIN_VOLUME: positiveInteger(5),
  TEMPLATE_TRENDING_ROW_MIN_TEMPLATES: positiveInteger(4)
});

export type TemplateMarketplaceConfig = z.infer<typeof envSchema>;
