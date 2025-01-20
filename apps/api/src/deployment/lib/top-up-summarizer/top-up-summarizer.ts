interface TopUpSummary {
  deploymentCount: number;
  deploymentTopUpCount: number;
  insufficientBalanceCount: number;
  walletsCount: number;
  walletsTopUpCount: number;
  minPredictedClosedHeight: number;
  maxPredictedClosedHeight: number;
  walletsTopUpErrorCount: number;
  deploymentTopUpErrorCount: number;
  startBlockHeight: number;
  endBlockHeight: number;
}

export class TopUpSummarizer {
  private deploymentCount = 0;

  private deploymentTopUpCount = 0;

  private insufficientBalanceCount = 0;

  private walletsCount = 0;

  private walletsTopUpCount = 0;

  private walletsTopUpErrorCount = 0;

  private deploymentTopUpErrorCount = 0;

  private minPredictedClosedHeight: number;

  private maxPredictedClosedHeight: number;

  private startBlockHeight: number;

  private endBlockHeight: number;

  inc(param: keyof TopUpSummary, value = 1) {
    this[param] += value;
  }

  set(param: keyof Pick<TopUpSummary, "startBlockHeight" | "endBlockHeight">, value: number) {
    this[param] = value;
  }

  get(param: keyof TopUpSummary) {
    return this[param];
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
      walletsCount: this.walletsCount,
      walletsTopUpCount: this.walletsTopUpCount,
      insufficientBalanceCount: this.insufficientBalanceCount,
      walletsTopUpErrorCount: this.walletsTopUpErrorCount,
      deploymentTopUpErrorCount: this.deploymentTopUpErrorCount,
      deploymentCount: this.deploymentCount,
      deploymentTopUpCount: this.deploymentTopUpCount,
      minPredictedClosedHeight: this.minPredictedClosedHeight,
      maxPredictedClosedHeight: this.maxPredictedClosedHeight
    };
  }
}
