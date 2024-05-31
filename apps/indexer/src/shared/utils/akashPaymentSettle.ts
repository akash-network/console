import { Deployment, Lease } from "@akashnetwork/cloudmos-shared/dbSchemas/akash";

// This copies the logic of the akash node

// Port of https://github.com/akash-network/akash/blob/c2be64614f7417cf99447185f9d13b49bf33dadb/x/escrow/keeper/keeper.go#L353
export async function accountSettle(deployment: Deployment, height: number, blockGroupTransaction): Promise<{ blockRate: number }> {
  if (!deployment) throw new Error("Deployment is missing");
  if (!deployment.leases) throw new Error("Deployment.leases is missing");

  const activeLeases = deployment.leases.filter((x) => !x.closedHeight);
  const blockRate = activeLeases.map((x) => x.price).reduce((a, b) => a + b, 0);

  if (height === deployment.lastWithdrawHeight) return { blockRate };

  const heightDelta = height - deployment.lastWithdrawHeight;

  deployment.lastWithdrawHeight = height;

  if (activeLeases.length === 0) {
    await deployment.save({ transaction: blockGroupTransaction });
    return { blockRate: 0 };
  }

  const { overdrawn, remaining } = accountSettleFullBlocks(deployment, activeLeases, heightDelta, blockRate);

  if (!overdrawn) {
    await deployment.save({ transaction: blockGroupTransaction });
    for (const lease of activeLeases) {
      await lease.save({ transaction: blockGroupTransaction });
    }

    return { blockRate };
  }

  // Overdrawn

  const newRemaining = accountSettleDistributeWeighted(deployment, activeLeases, blockRate, remaining);

  if (newRemaining > 1) {
    throw new Error(`Invalid settlement: ${newRemaining} remains`);
  }

  deployment.closedHeight = height;
  await deployment.save({ transaction: blockGroupTransaction });
  for (const lease of activeLeases) {
    lease.closedHeight = height;
    await lease.save({ transaction: blockGroupTransaction });
  }

  return { blockRate };
}

// Port of https://github.com/akash-network/akash/blob/c2be64614f7417cf99447185f9d13b49bf33dadb/x/escrow/keeper/keeper.go#L543
function accountSettleFullBlocks(
  deployment: Deployment,
  activeLeases: Lease[],
  heightDelta: number,
  blockRate: number
): { overdrawn: boolean; remaining: number } {
  let numFullBlocks = Math.min(Math.floor(deployment.balance / blockRate), heightDelta);

  for (const lease of activeLeases) {
    lease.withdrawnAmount += numFullBlocks * lease.price;
  }

  const transferred = blockRate * numFullBlocks;

  deployment.withdrawnAmount += transferred;
  deployment.balance -= transferred;

  let remaining = deployment.balance;
  let overdrawn = true;
  if (numFullBlocks === heightDelta) {
    remaining = 0;
    overdrawn = false;
  }

  if (overdrawn) {
    deployment.balance = remaining;
  }

  return { overdrawn, remaining };
}

// Port of https://github.com/akash-network/akash/blob/c2be64614f7417cf99447185f9d13b49bf33dadb/x/escrow/keeper/keeper.go#L594
function accountSettleDistributeWeighted(deployment: Deployment, activeLeases: Lease[], blockRate: number, remaining: number) {
  let transferred = 0;

  for (const lease of activeLeases) {
    const amount = (remaining * lease.price) / blockRate;
    lease.withdrawnAmount += amount;
    transferred += amount;
  }

  deployment.withdrawnAmount += transferred;
  deployment.balance -= transferred;

  return remaining - transferred;
}
