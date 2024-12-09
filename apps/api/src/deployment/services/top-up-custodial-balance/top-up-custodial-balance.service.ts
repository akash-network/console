interface Balances {
  denom: string;
  feesLimit: number;
  deploymentLimit: number;
  balance: number;
  feesBalance?: number;
}

export class TopUpCustodialBalanceService {
  constructor(readonly balances: Balances) {}

  recordTx(amount: number, fees: number) {
    this.balances.deploymentLimit -= amount;
    this.balances.balance -= amount;
    this.balances.feesLimit -= fees;

    if (this.balances.denom === "uakt") {
      this.balances.balance -= fees;
    } else {
      this.balances.feesBalance -= fees;
    }
  }
}
