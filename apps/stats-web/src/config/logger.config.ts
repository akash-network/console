import { LoggerService } from "@akashnetwork/logging";

import { browserEnvConfig } from "@/config/browser-env.config";

LoggerService.configure({ LOG_LEVEL: browserEnvConfig.VITE_LOG_LEVEL });
