import { z } from "zod";

export const envSchema = z.object({
  TEAM_ORGANIZATIONS_PER_USER_LIMIT: z.number({ coerce: true }).int().positive().optional().default(3),
  PROJECTS_PER_ORGANIZATION_LIMIT: z.number({ coerce: true }).int().positive().optional().default(10)
});

export type OrganizationConfig = z.infer<typeof envSchema>;
