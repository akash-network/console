import type { Balance, Denom } from "@akashnetwork/http-sdk";
import { BalanceHttpService } from "@akashnetwork/http-sdk";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

import { WALLET_ADDRESS_PREFIX } from "@src/billing/services";
import { withFaucetLock } from "./fs-lock";
import { balanceWaitPolicy, faucetRetryPolicy } from "./retry-policies";

const { parsed: config } = dotenvExpand.expand(dotenv.config({ path: "env/.env.functional.test" }));

export interface TopUpWalletOptions {
  /** @default process.env.FUNDING_WALLET_ADDRESS */
  address?: string;
  denom?: Denom;
  minAmount?: string | bigint | number;
}

const balanceHttpService = new BalanceHttpService({
  baseURL: config!.REST_API_NODE_URL
});

export async function topUpWallet(options: TopUpWalletOptions = {}): Promise<Balance> {
  const { denom = "uakt", minAmount = 1_000_000 } = options;
  const minAmountBigInt = BigInt(minAmount);
  const address = options.address ?? (await getFundingWalletAddress());

  const currentBalance = await balanceHttpService.getBalance(address, denom);
  const currentAmount = BigInt(currentBalance?.amount ?? "0");

  if (currentAmount >= minAmountBigInt) {
    return currentBalance ?? { denom: denom as Denom, amount: 0 };
  }

  return withFaucetLock(async () => {
    // Re-check balance after acquiring lock (another worker might have topped up)
    const balanceAfterLock = await balanceHttpService.getBalance(address, denom);
    const amountAfterLock = BigInt(balanceAfterLock?.amount ?? "0");

    if (amountAfterLock >= minAmountBigInt) {
      return balanceAfterLock ?? { denom: denom as Denom, amount: 0 };
    }

    await faucetRetryPolicy.execute(async () => {
      await topUpViaFaucet(config!.FAUCET_URL, address);
    });

    const finalBalance = await balanceWaitPolicy.execute(async () => {
      const balance = await balanceHttpService.getBalance(address, denom);
      const amount = BigInt(balance?.amount ?? "0");

      if (amount < minAmountBigInt) {
        throw new Error(`Balance not yet updated: ${amount} < ${minAmountBigInt}`);
      }

      return balance ?? { denom: denom as Denom, amount: 0 };
    });

    return finalBalance;
  });
}

let fundingWalletAddressPromise: Promise<string> | undefined;
function getFundingWalletAddress(): Promise<string> {
  fundingWalletAddressPromise ??= DirectSecp256k1HdWallet.fromMnemonic(process.env.FUNDING_WALLET_MNEMONIC!, { prefix: WALLET_ADDRESS_PREFIX })
    .then(wallet => wallet.getAccounts())
    .then(accounts => accounts[0].address);
  return fundingWalletAddressPromise;
}

async function topUpViaFaucet(faucetUrl: string, address: string): Promise<void> {
  const response = await fetch(faucetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `address=${encodeURIComponent(address)}`
  });

  if (response.status >= 300 || response.status < 200) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`Faucet request failed with status ${response.status}: ${errorBody}`);
  }
}
