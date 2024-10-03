import { browserEnvConfig } from "@/config/browser-env.config";
import { ApiUrlService } from "@/services/api-url/api-url.service";

export const browserApiUrlService = new ApiUrlService(browserEnvConfig);
