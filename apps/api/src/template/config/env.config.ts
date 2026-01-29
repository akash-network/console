import z from "zod";

export const envSchema = z.object({
  GITHUB_PAT: z.string().optional(),
  TEMPLATE_REFRESH_INTERVAL_SECONDS: z.coerce
    .number()
    .optional()
    .default(15 * 60),
  TEMPLATE_REFRESH_ENABLED: z
    .string()
    .default("false")
    .transform(value => value === "true")
});

export type TemplateConfig = z.infer<typeof envSchema>;
