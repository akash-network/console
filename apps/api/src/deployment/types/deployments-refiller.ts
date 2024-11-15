import { DryRunOptions } from "@src/core/types/console";

export interface TopUpDeploymentsOptions extends DryRunOptions {}

export interface DeploymentsRefiller {
  topUpDeployments(options: TopUpDeploymentsOptions): Promise<void>;
}
