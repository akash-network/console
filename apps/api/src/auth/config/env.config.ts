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

export const envSchema = z.object({
  AUTH0_M2M_DOMAIN: z.string(),
  AUTH0_M2M_CLIENT_ID: z.string(),
  AUTH0_M2M_SECRET: z.string(),
  AUTH0_JWKS_URI: z.string().url(),
  /** Must match the `iss` claim byte for byte, so Auth0 issuers keep their trailing slash. */
  AUTH0_ISSUER: commaSeparatedList(z.string().url()),
  AUTH0_AUDIENCE: commaSeparatedList(z.string())
});
