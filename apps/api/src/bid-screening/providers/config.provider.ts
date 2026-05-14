import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";
import type z from "zod";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { type BidScreeningConfig, envSchema } from "../config/env.config";

export const BID_SCREENING_CONFIG = Symbol("BID_SCREENING_CONFIG") as InjectionToken<z.infer<typeof envSchema>>;
container.register(BID_SCREENING_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { BidScreeningConfig };
