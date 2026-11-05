import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type FeedbackConfig } from "../config/env.config";

export const FEEDBACK_CONFIG = Symbol("FEEDBACK_CONFIG") as InjectionToken<FeedbackConfig>;
container.register(FEEDBACK_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { FeedbackConfig };
