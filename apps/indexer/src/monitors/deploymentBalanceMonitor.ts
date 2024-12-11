import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { MonitoredValue } from "@akashnetwork/database/dbSchemas/base/monitoredValue";
import { LoggerService } from "@akashnetwork/logging";
import * as Sentry from "@sentry/node";
import axios from "axios";

const logger = LoggerService.forContext("DeploymentBalanceMonitor");

export class DeploymentBalanceMonitor {
  async run() {
    const monitoredValues = await MonitoredValue.findAll({
      where: {
        tracker: "DeploymentBalanceMonitor"
      }
    });

    await Promise.allSettled(monitoredValues.map(x => this.updateValue(x)));

    logger.info("Refreshed balances for " + monitoredValues.length + " deployments.");
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
      logger.error(err);

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
