import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import type { BillingConfig } from "@src/billing/config/env.config";
import { envSchema } from "@src/billing/config/env.config";
import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";

export const BILLING_CONFIG: InjectionToken<BillingConfig> = Symbol("BILLING_CONFIG");

container.register(BILLING_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { BillingConfig };

export const InjectBillingConfig = () => inject(BILLING_CONFIG);
