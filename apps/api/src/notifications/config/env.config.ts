import { z } from "zod";

export const envSchema = z.object({
  NOTIFICATIONS_API_BASE_URL: z.string()
});

export type NotificationsConfig = z.infer<typeof envSchema>;
