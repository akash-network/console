import type { ConcurrencyOptions, DryRunOptions } from "@src/core/types/console";

export interface TopUpDeploymentsOptions extends DryRunOptions, ConcurrencyOptions {}

export interface DeploymentsRefiller {
  topUpDeployments(options: TopUpDeploymentsOptions): Promise<void>;
}
