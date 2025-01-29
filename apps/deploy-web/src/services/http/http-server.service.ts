import { serverEnvConfig } from "@src/config/server-env.config";
import { createServices } from "@src/services/http-factory/http-factory.service";

export const services = createServices({
  ...serverEnvConfig,
  BASE_PROVIDER_PROXY_URL: serverEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL
});
