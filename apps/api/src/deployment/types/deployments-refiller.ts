export interface TopUpDeploymentsOptions {
  dryRun: boolean;
}

export interface DeploymentsRefiller {
  topUpDeployments(options: TopUpDeploymentsOptions): Promise<void>;
}
