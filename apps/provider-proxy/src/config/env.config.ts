import { z } from "zod";

export const appConfigSchema = z.object({
  REST_API_NODE_URL: z.string().url(),
  ALLOW_PROXY_TO_LOCAL_NETWORK: z
    .enum(["true", "false"])
    .default("false")
    .transform(val => val === "true"),
  PORT: z.number({ coerce: true }).min(0).default(3040)
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type AppConfigInput = z.input<typeof appConfigSchema>;
