import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { MonitoredValue } from "@akashnetwork/database/dbSchemas/base/monitoredValue";
import axios from "axios";

export class AddressBalanceMonitor {
  async run() {
    const monitoredValues = await MonitoredValue.findAll({
      where: {
        tracker: "AddressBalanceMonitor"
      }
    });

    await Promise.allSettled(monitoredValues.map(x => this.updateValue(x)));

    console.log("Refreshed balances for " + monitoredValues.length + " addresses.");
  }

  async updateValue(monitoredValue: MonitoredValue) {
    const [targetAddress, targetToken] = monitoredValue.target.split("|");
    const balance = await this.getBalance(targetAddress, targetToken);

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
      return 0;
    }

    return parseInt(balance.amount);
  }
}
