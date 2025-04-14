import { serverEnvConfig } from "@src/config/server-env.config";
import { createServices } from "@src/services/http-factory/http-factory.service";
import { clientIpForwardingInterceptor } from "../client-ip-forwarding/client-ip-forwarding.interceptor";

export const services = createServices({
  ...serverEnvConfig,
  BASE_PROVIDER_PROXY_URL: serverEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  globalRequestMiddleware: clientIpForwardingInterceptor
});
