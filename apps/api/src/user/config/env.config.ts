import { z } from "zod";

export const envSchema = z.object({
  EMAIL_UNSUBSCRIBE_SECRET: z.string().optional()
});

export type UserConfig = z.infer<typeof envSchema>;
