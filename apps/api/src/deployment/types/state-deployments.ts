import type { ConcurrencyOptions, DryRunOptions } from "@src/core/types/console";

export interface CleanUpStaleDeploymentsParams extends ConcurrencyOptions, DryRunOptions {}
