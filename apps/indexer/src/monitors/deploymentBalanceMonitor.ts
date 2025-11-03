import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { MonitoredValue } from "@akashnetwork/database/dbSchemas/base/monitoredValue";
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

  async getDeploymentBalance(target: string): Promise<number | null> {
    const [owner, dseq] = target.split("/");
    const response = await axios.get(`https://rest.cosmos.directory/akash/akash/deployment/v1beta4/deployments/info?id.owner=${owner}&id.dseq=${dseq}`, {
      timeout: 15_000
    });

    const escrowState = response?.data?.escrow_account?.state;
    if (!escrowState?.funds) {
      return null;
    }

    const funds = escrowState.funds.find((f: { denom: string; amount: string }) => f.denom === activeChain.denom || f.denom === activeChain.udenom);

    if (!funds) {
      return null;
    }

    const fundsAmount = funds.denom === activeChain.udenom ? parseInt(funds.amount) : parseInt(funds.amount) * 1_000_000;

    return fundsAmount;
  }
}
