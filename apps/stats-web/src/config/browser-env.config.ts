import { validateStaticEnvVars } from "./env-config.schema";

export const browserEnvConfig = validateStaticEnvVars({
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: process.env.NEXT_PUBLIC_DEFAULT_NETWORK_ID,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL
});
