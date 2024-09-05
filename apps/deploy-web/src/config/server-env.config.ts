import "@akashnetwork/env-loader";

import { castToValidatedOnStartup } from "./env-config.schema";

export const serverEnvConfig = castToValidatedOnStartup(process.env);
