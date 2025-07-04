import { browserEnvConfig } from "@src/config/browser-env.config";
import { ApiUrlService } from "@src/services/api-url/api-url.service";

/** @deprecated use `useServices()` hook instead */
export const browserApiUrlService = new ApiUrlService(browserEnvConfig);
