import * as unleashModule from "@unleash/nextjs";

import { serverEnvConfig } from "@src/config/server-env.config";
import { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";

export const featureFlagService = new FeatureFlagService(unleashModule, serverEnvConfig);
