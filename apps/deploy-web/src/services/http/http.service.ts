import { ManagedWalletHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";

import { authService } from "@src/services/auth/auth.service";
import { BASE_API_URL } from "@src/utils/constants";
import { customRegistry } from "@src/utils/customRegistry";

const apiConfig = { baseURL: BASE_API_URL };

export const userHttpService = new UserHttpService(apiConfig);
export const managedWalletHttpService = new ManagedWalletHttpService(apiConfig);
export const txHttpService = new TxHttpService(customRegistry, apiConfig);

userHttpService.interceptors.request.use(authService.withAnonymousUserHeader);
managedWalletHttpService.interceptors.request.use(authService.withAnonymousUserHeader);
txHttpService.interceptors.request.use(authService.withAnonymousUserHeader);
