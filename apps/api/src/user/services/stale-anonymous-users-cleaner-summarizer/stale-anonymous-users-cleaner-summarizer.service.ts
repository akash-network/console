interface StaleAnonymousUsersCleanerSummary {
  feeAllowanceRevokeCount: number;
  deploymentGrantRevokeCount: number;
  revokeErrorCount: number;
  usersDroppedCount: number;
}

export class StaleAnonymousUsersCleanerSummarizer {
  private feeAllowanceRevokeCount = 0;

  private deploymentGrantRevokeCount = 0;

  private revokeErrorCount = 0;

  private usersDroppedCount = 0;

  inc(param: keyof StaleAnonymousUsersCleanerSummary, value = 1) {
    this[param] += value;
  }

  summarize(): StaleAnonymousUsersCleanerSummary {
    return {
      feeAllowanceRevokeCount: this.feeAllowanceRevokeCount,
      deploymentGrantRevokeCount: this.deploymentGrantRevokeCount,
      revokeErrorCount: this.revokeErrorCount,
      usersDroppedCount: this.usersDroppedCount
    };
  }
}
