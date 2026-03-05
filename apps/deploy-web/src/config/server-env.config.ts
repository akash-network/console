import "@akashnetwork/env-loader";

import { validateRuntimeEnvVars } from "./env-config.schema";

/** @deprecated use services.privateConfig from server-di-container.service.ts instead */
export const serverEnvConfig = validateRuntimeEnvVars(process.env);
