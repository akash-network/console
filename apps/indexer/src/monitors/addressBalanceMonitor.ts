import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { MonitoredValue } from "@akashnetwork/database/dbSchemas/base/monitoredValue";
import { LoggerService } from "@akashnetwork/logging";
import axios from "axios";

const logger = LoggerService.forContext("AddressBalanceMonitor");

export class AddressBalanceMonitor {
  async run() {
    const monitoredValues = await MonitoredValue.findAll({
      where: {
        tracker: "AddressBalanceMonitor"
      }
    });

    await Promise.allSettled(monitoredValues.map(x => this.updateValue(x)));

    logger.info("Refreshed balances for " + monitoredValues.length + " addresses.");
  }

  async updateValue(monitoredValue: MonitoredValue) {
    const [targetAddress, targetToken] = monitoredValue.target.split("|");
    const balance = await this.getBalance(targetAddress, targetToken);

    if (balance === null) {
      throw new Error("Unable to get balance for " + monitoredValue.target);
    }

    monitoredValue.value = balance.toString();
    monitoredValue.lastUpdateDate = new Date();
    await monitoredValue.save();
  }

  async getBalance(address: string, denom?: string): Promise<number> {
    const response = await axios.get(`https://rest.cosmos.directory/${activeChain.cosmosDirectoryId}/cosmos/bank/v1beta1/balances/${address}`, {
      timeout: 15_000
    });

    const balance = response.data.balances.find(x => x.denom === (denom || activeChain.udenom));

    if (!balance) {
      return null;
    }

    return parseInt(balance.amount);
  }
}
