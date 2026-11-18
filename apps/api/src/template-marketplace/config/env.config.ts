import { z } from "zod";

function blankToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function positiveInteger(fallback: number) {
  return z.preprocess(blankToUndefined, z.number({ coerce: true }).int().positive().default(fallback));
}

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const envSchema = z.object({
  TEMPLATE_CREATE_LIMIT_PER_USER: positiveInteger(20),
  TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: positiveInteger(60),
  TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: positiveInteger(HOUR_SECONDS),
  TEMPLATE_VERSION_LIMIT_PER_USER: positiveInteger(60),
  TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: positiveInteger(180),
  TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: positiveInteger(HOUR_SECONDS),
  TEMPLATE_PUBLISH_LIMIT_PER_USER: positiveInteger(10),
  TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: positiveInteger(30),
  TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: positiveInteger(DAY_SECONDS)
});

export type TemplateMarketplaceConfig = z.infer<typeof envSchema>;
