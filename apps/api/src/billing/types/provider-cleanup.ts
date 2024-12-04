import { ConcurrencyOptions, DryRunOptions } from "@src/core/types/console";

export interface ProviderCleanupParams extends DryRunOptions, ConcurrencyOptions {
  provider: string;
}
