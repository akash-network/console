import z from "zod";

export const envSchema = z.object({
  GITHUB_PAT: z.string().optional()
});

export type TemplateConfig = z.infer<typeof envSchema>;
