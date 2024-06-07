import { activeChain } from "@akashnetwork/cloudmos-shared/chainDefinitions";
import { MonitoredValue } from "@akashnetwork/cloudmos-shared/dbSchemas/base/monitoredValue";
import * as Sentry from "@sentry/node";
import axios from "axios";

export class DeploymentBalanceMonitor {
  async run() {
    const monitoredValues = await MonitoredValue.findAll({
      where: {
        tracker: "DeploymentBalanceMonitor"
      }
    });

    await Promise.allSettled(monitoredValues.map(x => this.updateValue(x)));

    console.log("Refreshed balances for " + monitoredValues.length + " deployments.");
  }

  async updateValue(monitoredValue: MonitoredValue) {
    try {
      const balance = await this.getDeploymentBalance(monitoredValue.target);

      if (balance === null) {
        throw new Error("Unable to get balance for " + monitoredValue.target);
      }

      monitoredValue.value = balance.toString();
      monitoredValue.lastUpdateDate = new Date();
      await monitoredValue.save();
    } catch (err) {
      console.error(err);

      Sentry.captureException(err, { tags: { target: monitoredValue.target } });
    }
  }

  async getDeploymentBalance(target: string): Promise<number> {
    const [owner, dseq] = target.split("/");
    const response = await axios.get(`https://rest.cosmos.directory/akash/akash/deployment/v1beta3/deployments/info?id.owner=${owner}&id.dseq=${dseq}`, {
      timeout: 15_000
    });

    const balance = response.data.escrow_account.balance;
    const funds = response.data.escrow_account.funds;
    const isAktDenom = balance.denom === activeChain.denom || balance.denom === activeChain.udenom;

    if (!balance || !funds || !isAktDenom) {
      return null;
    }

    const balanceAmount = balance.denom === activeChain.udenom ? parseInt(balance.amount) : parseInt(balance.amount) * 1_000_000;
    const fundsAmount = funds.denom === activeChain.udenom ? parseInt(funds.amount) : parseInt(funds.amount) * 1_000_000;

    return balanceAmount + fundsAmount;
  }
}
