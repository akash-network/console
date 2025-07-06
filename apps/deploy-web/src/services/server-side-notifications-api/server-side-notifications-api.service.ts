import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { serverEnvConfig } from "@src/config/server-env.config";

/**
 * @deprecated use from http-services.ts instead
 */
export const notificationsApi = createAPIClient({
  requestFn,
  baseUrl: serverEnvConfig.BASE_API_MAINNET_URL
});
