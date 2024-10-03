import { serverEnvConfig } from "@/config/server-env.config";
import { ApiUrlService } from "@/services/api-url/api-url.service";

export const serverApiUrlService = new ApiUrlService(serverEnvConfig);
