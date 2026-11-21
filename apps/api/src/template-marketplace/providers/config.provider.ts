import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type TemplateMarketplaceConfig } from "../config/env.config";

export const TEMPLATE_MARKETPLACE_CONFIG = Symbol("TEMPLATE_MARKETPLACE_CONFIG") as InjectionToken<TemplateMarketplaceConfig>;

container.register(TEMPLATE_MARKETPLACE_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export const InjectTemplateMarketplaceConfig = () => inject(TEMPLATE_MARKETPLACE_CONFIG);

export type { TemplateMarketplaceConfig };
