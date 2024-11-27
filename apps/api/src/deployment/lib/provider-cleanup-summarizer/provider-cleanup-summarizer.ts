interface ProviderCleanupSummary {
  deploymentCount: number;
}

export class ProviderCleanupSummarizer {
  private deploymentCount = 0;

  inc(param: keyof ProviderCleanupSummary, value = 1) {
    this[param] += value;
  }

  set(param: keyof ProviderCleanupSummary, value: number) {
    this[param] = value;
  }

  get(param: keyof ProviderCleanupSummary) {
    return this[param];
  }

  summarize(): ProviderCleanupSummary {
    return {
      deploymentCount: this.deploymentCount
    };
  }
}
