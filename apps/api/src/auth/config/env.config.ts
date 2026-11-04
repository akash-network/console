import { z } from "zod";

const commaSeparatedList = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform(value =>
      value
        .split(",")
        .map(entry => entry.trim())
        .filter(Boolean)
    )
    .pipe(z.array(item).nonempty());

export const envSchema = z
  .object({
    AUTH0_M2M_DOMAIN: z.string(),
    AUTH0_M2M_CLIENT_ID: z.string(),
    AUTH0_M2M_SECRET: z.string(),
    AUTH0_JWKS_URI: z.string().url(),
    /** Must match the `iss` claim byte for byte, so Auth0 issuers keep their trailing slash. */
    AUTH0_ISSUER: commaSeparatedList(z.string().url()),
    AUTH0_AUDIENCE: commaSeparatedList(z.string()),
    TURNSTILE_REQUIRED: z
      .enum(["true", "false"])
      .default("false")
      .transform(value => value === "true"),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    /** @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/#test-secret-keys */
    TURNSTILE_BYPASS_SECRET_KEY: z.string().default("1x0000000000000000000000000000000AA"),
    E2E_TESTING_CLIENT_TOKEN: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.TURNSTILE_REQUIRED && !value.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TURNSTILE_SECRET_KEY is required when TURNSTILE_REQUIRED is true"
      });
    }
  });
