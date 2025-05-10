import type { Result } from "ts-results";

import type { ConcurrencyOptions, DryRunOptions } from "@src/core/types/console";

export interface TopUpDeploymentsOptions extends DryRunOptions, ConcurrencyOptions {}

export interface DeploymentsRefiller {
  topUpDeployments(options: TopUpDeploymentsOptions): Promise<Result<void, Error[]>>;
}
