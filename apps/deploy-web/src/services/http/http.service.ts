import { TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { authService } from "@src/services/auth/auth.service";
import { customRegistry } from "@src/utils/customRegistry";

const apiConfig = { baseURL: browserEnvConfig.NEXT_PUBLIC_API_BASE_URL };

export const userHttpService = new UserHttpService(apiConfig);
export const txHttpService = new TxHttpService(customRegistry, apiConfig);

userHttpService.interceptors.request.use(authService.withAnonymousUserHeader);

txHttpService.interceptors.request.use(authService.withAnonymousUserHeader);
