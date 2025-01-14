"use client";

import { LoggerService } from "@akashnetwork/logging";

import { browserEnvConfig } from "./browser-env.config";

LoggerService.configure({ LOG_LEVEL: browserEnvConfig.NEXT_PUBLIC_LOG_LEVEL });
