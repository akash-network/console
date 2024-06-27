import { container, inject } from "tsyringe";

import { config } from "@src/billing/config";

export const BILLING_CONFIG = "BILLING_CONFIG";

container.register(BILLING_CONFIG, { useValue: config });

export type BillingConfig = typeof config;

export const InjectBillingConfig = () => inject(BILLING_CONFIG);
