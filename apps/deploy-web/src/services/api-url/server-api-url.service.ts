import { serverEnvConfig } from "@src/config/server-env.config";
import { ApiUrlService } from "@src/services/api-url/api-url.service";

export const serverApiUrlService = new ApiUrlService(serverEnvConfig);
