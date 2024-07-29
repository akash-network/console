import { ManagedWalletHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";

import { BASE_API_URL } from "@src/utils/constants";
import { customRegistry } from "@src/utils/customRegistry";

const apiConfig = { baseURL: BASE_API_URL };

export const userHttpService = new UserHttpService(apiConfig);
export const txHttpService = new TxHttpService(customRegistry, apiConfig);
export const managedWalletHttpService = new ManagedWalletHttpService(apiConfig);
