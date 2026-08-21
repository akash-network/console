import { decFromString, decMul, decToString, decTruncateInt } from "@src/akash/dec";

/**
 * Ports the per-deployment math of the chain's denom migration (`x/deployment/migrate/v7`): every
 * Dec amount multiplies by the AKT/USD rate with LegacyDec rounding, and integer Coin amounts use
 * the chain's `rate.MulInt().TruncateInt()`. The axlUSDC pass is the same code path at rate 1.
 */
export const RATE_ONE = decFromString("1");

export function parseRate(rate: string): bigint {
  const atomics = decFromString(rate);
  if (atomics <= 0n) {
    throw new Error(`Invalid AKT/USD rate for ACT migration: ${rate}`);
  }
  return atomics;
}

export function convertDeploymentAmounts(
  input: { balance: string; deposit: string; withdrawnAmount: string; blockRate: string },
  rate: bigint
): { balance: string; deposit: string; withdrawnAmount: string; blockRate: string } {
  return {
    balance: decToString(decMul(decFromString(input.balance), rate)),
    deposit: convertIntCoinAmount(input.deposit, rate),
    withdrawnAmount: decToString(decMul(decFromString(input.withdrawnAmount), rate)),
    blockRate: decToString(decMul(decFromString(input.blockRate), rate))
  };
}

/** `withdrawn` mirrors the on-chain integer Coin: convert its integral value, truncating like the chain. */
export function convertLeaseAmounts(
  input: { price: string; balance: string; withdrawnAmount: string },
  rate: bigint
): { price: string; balance: string; withdrawnAmount: string } {
  return {
    price: decToString(decMul(decFromString(input.price), rate)),
    balance: decToString(decMul(decFromString(input.balance), rate)),
    withdrawnAmount: convertIntCoinAmount(decTruncateInt(decFromString(input.withdrawnAmount)).toString(), rate)
  };
}

export function convertPriceAmount(price: string, rate: bigint): string {
  return decToString(decMul(decFromString(price), rate));
}

/**
 * What this deployment contributes to the block's burn/mint bank events: the chain sums the
 * non-negative escrow funds and payment balances as Decs, converts them, and truncates each
 * deployment's totals to whole coins before adding them to the per-block aggregate.
 */
export function conversionBankContribution(input: { balance: string; leaseBalances: string[] }, rate: bigint): { burned: bigint; minted: bigint } {
  let sourceSum = 0n;
  let convertedSum = 0n;

  const funds = decFromString(input.balance);
  if (funds >= 0n) {
    sourceSum += funds;
    convertedSum += decMul(funds, rate);
  }

  for (const leaseBalance of input.leaseBalances) {
    const balance = decFromString(leaseBalance);
    if (balance >= 0n) {
      sourceSum += balance;
      convertedSum += decMul(balance, rate);
    }
  }

  return { burned: decTruncateInt(sourceSum), minted: decTruncateInt(convertedSum) };
}

/** The chain's `convertCoin`: `rate.MulInt(amount).TruncateInt()` over an integer micro-denom amount. */
function convertIntCoinAmount(amount: string, rate: bigint): string {
  return decTruncateInt(rate * BigInt(amount)).toString();
}
