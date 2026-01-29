import z from "zod";

export const envSchema = z.object({
  GITHUB_PAT: z.string().optional(),
  TEMPLATE_REFRESH_INTERVAL_SECONDS: z.coerce
    .number()
    .optional()
    .default(15 * 60)
});

export type TemplateConfig = z.infer<typeof envSchema>;
