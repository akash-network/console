import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { TemplateConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const TEMPLATE_CONFIG: InjectionToken<TemplateConfig> = Symbol("TEMPLATE_CONFIG");

container.register(TEMPLATE_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { TemplateConfig };
