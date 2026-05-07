import { z } from "zod";

export const envSchema = z
  .object({
    NOTIFICATIONS_API_BASE_URL: z.string().optional(),
    NOTIFICATIONS_SWAGGER_PATH: z.string().optional()
  })
  .superRefine((env, ctx) => {
    if (process.env.INTERFACE === "swagger-gen") {
      if (!env.NOTIFICATIONS_SWAGGER_PATH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NOTIFICATIONS_SWAGGER_PATH"],
          message: "NOTIFICATIONS_SWAGGER_PATH is required in swagger-gen mode"
        });
      }
      return;
    }

    if (!env.NOTIFICATIONS_API_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NOTIFICATIONS_API_BASE_URL"],
        message: "NOTIFICATIONS_API_BASE_URL is required outside swagger-gen mode"
      });
    }
  });

export type NotificationsConfig = z.infer<typeof envSchema>;
