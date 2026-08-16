import { decMul, decMulInt, decQuo, decTruncateInt, minBigInt } from "@src/akash/dec";

export interface SettlementDeployment {
  /** Escrow funds in Dec atomics (10^-18 of the u-denom unit). */
  balance: bigint;
  lastWithdrawHeight: number | null;
  closedHeight: number | null;
}

export interface SettlementLease {
  /** Per-block rate in Dec atomics; fractional since v1beta3 bids price in DecCoin. */
  price: bigint;
  /** Accrued-but-unwithdrawn earnings (the on-chain payment balance); payouts truncate from here. */
  balance: bigint;
  closedHeight: number | null;
}

export interface SettlementResult {
  /** Sum of the open leases' per-block rates before any overdraw close, in Dec atomics. */
  blockRate: bigint;
  overdrawn: boolean;
}

/** Escrow accounts settle to at most 1 u-denom unit of rounding dust on an overdraw close. */
const MAX_SETTLEMENT_DUST = 10n ** 18n;

/**
 * Port of akash-node x/escrow account settlement (x/escrow/keeper, accountSettle) on exact LegacyDec
 * math. Mutates the passed state objects: moves the exact Dec accrual since the last settlement from
 * the account funds into each open lease's unwithdrawn balance, and on overdraw distributes the
 * remaining funds by rate weight and closes the deployment with all open leases. Payouts (which
 * truncate to whole units, with the fraction refunded on lease close) are the caller's concern —
 * settlement only accrues.
 */
export function settle(deployment: SettlementDeployment, openLeases: SettlementLease[], height: number): SettlementResult {
  const blockRate = openLeases.reduce((sum, lease) => sum + lease.price, 0n);

  if (height === deployment.lastWithdrawHeight) return { blockRate, overdrawn: false };

  const heightDelta = BigInt(height - (deployment.lastWithdrawHeight ?? 0));
  deployment.lastWithdrawHeight = height;

  if (openLeases.length === 0) return { blockRate: 0n, overdrawn: false };

  if (blockRate <= 0n) return { blockRate, overdrawn: false };

  const numFullBlocks = minBigInt(decTruncateInt(decQuo(deployment.balance, blockRate)), heightDelta);

  for (const lease of openLeases) {
    lease.balance += decMulInt(lease.price, numFullBlocks);
  }
  deployment.balance -= decMulInt(blockRate, numFullBlocks);

  if (numFullBlocks === heightDelta) return { blockRate, overdrawn: false };

  distributeWeighted(deployment, openLeases, blockRate, height);
  return { blockRate, overdrawn: true };
}

function distributeWeighted(deployment: SettlementDeployment, openLeases: SettlementLease[], blockRate: bigint, height: number): void {
  const remaining = deployment.balance;
  let transferred = 0n;

  for (const lease of openLeases) {
    const amount = decQuo(decMul(remaining, lease.price), blockRate);
    lease.balance += amount;
    transferred += amount;
  }

  deployment.balance -= transferred;

  const dust = deployment.balance < 0n ? -deployment.balance : deployment.balance;
  if (dust > MAX_SETTLEMENT_DUST) {
    throw new Error(`Invalid settlement at height ${height}: ${deployment.balance} atomics remain after weighted distribution`);
  }

  deployment.closedHeight = height;
  for (const lease of openLeases) {
    lease.closedHeight = height;
  }
}
