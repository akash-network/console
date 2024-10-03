import "@akashnetwork/env-loader";

import { validateRuntimeEnvVars } from "./env-config.schema";

export const serverEnvConfig = validateRuntimeEnvVars(process.env);
