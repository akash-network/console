import { browserEnvSchema } from "./env-config.schema";

function getBrowserConfig() {
  const config = {
    NEXT_PUBLIC_ADMIN_API_URL: process.env.NEXT_PUBLIC_ADMIN_API_URL,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION
  };

  return browserEnvSchema.parse(config);
}

export const browserEnvConfig = getBrowserConfig();
