import { serverEnvConfig } from "@src/config/server-env.config";
import { ApiUrlService } from "@src/services/api-url/api-url.service";

/** @deprecated use `useServices()` hook instead */
export const serverApiUrlService = new ApiUrlService(serverEnvConfig);
