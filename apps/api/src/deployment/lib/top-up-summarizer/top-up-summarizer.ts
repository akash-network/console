interface TopUpSummary {
  deploymentCount: number;
  deploymentTopUpCount: number;
  deploymentTopUpErrorCount: number;
  insufficientBalanceCount: number;
  walletsCount: number;
  walletsTopUpCount: number;
  walletsTopUpErrorCount: number;
  startBlockHeight: number;
  endBlockHeight: number;
  minPredictedClosedHeight: number;
  maxPredictedClosedHeight: number;
  totalTopUpAmount: number;
}

export class TopUpSummarizer {
  private deploymentCount = 0;

  private deploymentTopUpCount = 0;

  private insufficientBalanceCount = 0;

  private deploymentTopUpErrorCount = 0;

  private minPredictedClosedHeight: number;

  private maxPredictedClosedHeight: number;

  private startBlockHeight: number;

  private endBlockHeight: number;

  private totalTopUpAmount = 0;

  private walletAddresses = new Set<string>();

  private successfulWalletAddresses = new Set<string>();

  private failedWalletAddresses = new Set<string>();

  inc(param: keyof Pick<TopUpSummary, "deploymentCount" | "deploymentTopUpCount" | "deploymentTopUpErrorCount" | "insufficientBalanceCount">, value = 1) {
    this[param] += value;
  }

  addTopUpAmount(amount: number) {
    this.totalTopUpAmount += amount;
  }

  set(param: keyof Pick<TopUpSummary, "startBlockHeight" | "endBlockHeight">, value: number) {
    this[param] = value;
  }

  get(param: keyof TopUpSummary) {
    if (param === "walletsCount") {
      return this.walletAddresses.size;
    }
    if (param === "walletsTopUpCount") {
      return this.successfulWalletAddresses.size;
    }
    if (param === "walletsTopUpErrorCount") {
      return this.failedWalletAddresses.size;
    }
    return this[param];
  }

  trackWallet(address: string) {
    this.walletAddresses.add(address);
  }

  trackSuccessfulWallet(address: string) {
    this.successfulWalletAddresses.add(address);
  }

  trackFailedWallet(address: string) {
    this.failedWalletAddresses.add(address);
  }

  ensurePredictedClosedHeight(height: number) {
    if (this.minPredictedClosedHeight === undefined || height < this.minPredictedClosedHeight) {
      this.minPredictedClosedHeight = height;
    }

    if (this.maxPredictedClosedHeight === undefined || height > this.maxPredictedClosedHeight) {
      this.maxPredictedClosedHeight = height;
    }
  }

  summarize(): TopUpSummary {
    return {
      startBlockHeight: this.startBlockHeight,
      endBlockHeight: this.endBlockHeight,
      deploymentCount: this.deploymentCount,
      deploymentTopUpCount: this.deploymentTopUpCount,
      deploymentTopUpErrorCount: this.deploymentTopUpErrorCount,
      insufficientBalanceCount: this.insufficientBalanceCount,
      walletsCount: this.walletAddresses.size,
      walletsTopUpCount: this.successfulWalletAddresses.size,
      walletsTopUpErrorCount: this.failedWalletAddresses.size,
      minPredictedClosedHeight: this.minPredictedClosedHeight,
      maxPredictedClosedHeight: this.maxPredictedClosedHeight,
      totalTopUpAmount: this.totalTopUpAmount
    };
  }
}
