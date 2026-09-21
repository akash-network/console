import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";
import type z from "zod";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type PlacementOptionsConfig } from "../config/env.config";

export const PLACEMENT_OPTIONS_CONFIG = Symbol("PLACEMENT_OPTIONS_CONFIG") as InjectionToken<z.infer<typeof envSchema>>;
container.register(PLACEMENT_OPTIONS_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { PlacementOptionsConfig };
