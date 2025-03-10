import { BalanceHttpService } from "@akashnetwork/http-sdk";
import { coins, EncodeObject } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import * as fs from "fs";
import keyBy from "lodash/keyBy";
import { setTimeout as delay } from "timers/promises";

import { Wallet } from "../../src/billing/lib/wallet/wallet";

const { parsed: config } = dotenvExpand.expand(dotenv.config({ path: "env/.env.functional.test" }));

type TestWalletServiceOptions = {
  testsDir: string;
};

type WalletConfig = {
  path: string;
  mnemonic: string;
  message: EncodeObject;
};

const MIN_AMOUNTS: Record<string, number> = {
  "create-deployment.spec.ts": 5100000
};

export class TestWalletService {
  static get instance() {
    return global.testWalletService;
  }

  static async init(options: TestWalletServiceOptions) {
    if (!global.testWalletService) {
      global.testWalletService = new TestWalletService(options);
      await global.testWalletService.init();
    }
    return global.testWalletService;
  }

  private readonly balanceHttpService = new BalanceHttpService({
    baseURL: config.API_NODE_ENDPOINT
  });

  private wallets: Record<string, WalletConfig>;

  constructor(private readonly options: TestWalletServiceOptions) {}

  getMnemonic(path: string) {
    const fileName = this.getFileName(path);
    return this.wallets[fileName].mnemonic;
  }

  async init() {
    const { wallet: faucetWallet, amount: faucetAmount } = await this.prepareFaucetWallet();
    this.wallets = await this.prepareWallets(faucetWallet, faucetAmount);
  }

  private async prepareWallets(faucetWallet: Wallet, totalDistibutionAmount: number) {
    const specPaths = fs.readdirSync(this.options.testsDir).filter(spec => spec.endsWith(".spec.ts"));
    const faucetAddress = await faucetWallet.getFirstAddress();
    const totalMinAmount = Object.values(MIN_AMOUNTS).reduce((acc, curr) => acc + curr, 0);
    const amount = (totalDistibutionAmount - totalMinAmount - totalDistibutionAmount * 0.01) / specPaths.length;

    const configs = await Promise.all(
      specPaths.map(async path => {
        const wallet = new Wallet();
        const address = await wallet.getFirstAddress();
        const fileName = this.getFileName(path);

        return {
          path,
          mnemonic: await wallet.getMnemonic(),
          address,
          message: {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
              fromAddress: faucetAddress,
              toAddress: address,
              amount: coins(MIN_AMOUNTS[fileName] || amount, "uakt")
            }
          }
        };
      })
    );
    const messages = Object.values(configs).map(config => config.message) as readonly EncodeObject[];

    const client = await SigningStargateClient.connectWithSigner(config.RPC_NODE_ENDPOINT, faucetWallet);
    const gasEstimation = await client.simulate(faucetAddress, messages, undefined);
    const estimatedGas = Math.round(gasEstimation * 1.5);

    const fee = calculateFee(estimatedGas, GasPrice.fromString("0.0025uakt"));

    await client.signAndBroadcast(faucetAddress, messages, fee);

    this.log("Created and filled wallets");
    await Promise.all(
      configs.map(async config => {
        const balance = await this.balanceHttpService.getBalance(config.address, "uakt");
        this.log(`Spec: ${config.path} - Address: ${config.address} - Balance: ${balance?.amount} uAKT`);
      })
    );

    return keyBy(configs, "path");
  }

  private async prepareFaucetWallet() {
    const faucetWallet = new Wallet();
    const faucetAddress = await faucetWallet.getFirstAddress();

    const initialBalance = await this.balanceHttpService.getBalance(faucetAddress, "uakt");
    const initialAmount = initialBalance?.amount;
    let updatedAmount = initialAmount;

    await this.topUpFaucetWallet(faucetAddress);

    while (initialAmount === updatedAmount) {
      const updatedBalance = await this.balanceHttpService.getBalance(faucetAddress, "uakt");
      updatedAmount = updatedBalance?.amount;
      await delay(1000);
    }

    return {
      wallet: faucetWallet,
      amount: updatedAmount
    };
  }

  private async topUpFaucetWallet(address: string) {
    const times = 1;
    for (let i = 0; i < times; i++) {
      await fetch(config.FAUCET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `address=${encodeURIComponent(address)}`
      });
    }
  }

  private getFileName(path: string) {
    return path.split("/").pop();
  }

  private log(message: string) {
    console.log(message);
  }
}
