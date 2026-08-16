import { describe, expect, it } from "vitest";

import { decFromInt, decFromString } from "@src/akash/dec";
import type { SettlementDeployment, SettlementLease } from "@src/akash/settlement";
import { settle } from "@src/akash/settlement";

describe("settle", () => {
  it("accrues a single lease's earnings for the full height delta", () => {
    const { deployment, leases } = setup({ balance: "1000000", leasePrices: ["10"], lastWithdrawHeight: 100 });

    const result = settle(deployment, leases, 150);

    expect(result).toEqual({ blockRate: decFromInt(10), overdrawn: false });
    expect(deployment.balance).toBe(decFromInt(1000000 - 500));
    expect(deployment.lastWithdrawHeight).toBe(150);
    expect(leases[0].balance).toBe(decFromInt(500));
    expect(leases[0].closedHeight).toBeNull();
  });

  it("is a no-op when already settled at this height", () => {
    const { deployment, leases } = setup({ balance: "1000", leasePrices: ["10"], lastWithdrawHeight: 150 });

    const result = settle(deployment, leases, 150);

    expect(result).toEqual({ blockRate: decFromInt(10), overdrawn: false });
    expect(deployment.balance).toBe(decFromInt(1000));
    expect(leases[0].balance).toBe(0n);
  });

  it("only stamps the settlement height when no leases are open", () => {
    const { deployment } = setup({ balance: "1000", leasePrices: [], lastWithdrawHeight: null });

    const result = settle(deployment, [], 150);

    expect(result).toEqual({ blockRate: 0n, overdrawn: false });
    expect(deployment.lastWithdrawHeight).toBe(150);
    expect(deployment.balance).toBe(decFromInt(1000));
  });

  it("splits full-block accrual between leases at their own rates", () => {
    const { deployment, leases } = setup({ balance: "10000", leasePrices: ["10", "30"], lastWithdrawHeight: 100 });

    settle(deployment, leases, 110);

    expect(leases[0].balance).toBe(decFromInt(100));
    expect(leases[1].balance).toBe(decFromInt(300));
    expect(deployment.balance).toBe(decFromInt(10000 - 400));
  });

  it("accrues fractional DecCoin rates exactly", () => {
    const { deployment, leases } = setup({ balance: "1000", leasePrices: ["1.5"], lastWithdrawHeight: 0 });

    settle(deployment, leases, 101);

    expect(leases[0].balance).toBe(decFromString("151.5"));
    expect(deployment.balance).toBe(decFromString("848.5"));
  });

  it("distributes the remaining balance by rate weight and closes everything on overdraw", () => {
    const { deployment, leases } = setup({ balance: "100", leasePrices: ["10", "30"], lastWithdrawHeight: 100 });

    const result = settle(deployment, leases, 110);

    expect(result).toEqual({ blockRate: decFromInt(40), overdrawn: true });
    expect(leases[0].balance).toBe(decFromInt(20 + 5));
    expect(leases[1].balance).toBe(decFromInt(60 + 15));
    expect(deployment.balance).toBe(0n);
    expect(deployment.closedHeight).toBe(110);
    expect(deployment.lastWithdrawHeight).toBe(110);
    expect(leases[0].closedHeight).toBe(110);
    expect(leases[1].closedHeight).toBe(110);
  });

  it("leaves at most one unit of rounding dust on an overdraw with uneven weights", () => {
    const { deployment, leases } = setup({ balance: "100", leasePrices: ["1", "1", "1"], lastWithdrawHeight: 0 });

    const result = settle(deployment, leases, 1000);

    expect(result.overdrawn).toBe(true);
    expect(deployment.balance).toBeGreaterThanOrEqual(0n);
    expect(deployment.balance).toBeLessThanOrEqual(decFromInt(1));
    const totalAccrued = leases.reduce((sum, lease) => sum + lease.balance, 0n);
    expect(totalAccrued + deployment.balance).toBe(decFromInt(100));
  });

  it("matches a one-shot settlement when settled incrementally", () => {
    const incremental = setup({ balance: "100000", leasePrices: ["7"], lastWithdrawHeight: 0 });
    const oneShot = setup({ balance: "100000", leasePrices: ["7"], lastWithdrawHeight: 0 });

    settle(incremental.deployment, incremental.leases, 100);
    settle(incremental.deployment, incremental.leases, 250);
    settle(incremental.deployment, incremental.leases, 400);
    settle(oneShot.deployment, oneShot.leases, 400);

    expect(incremental.deployment.balance).toBe(oneShot.deployment.balance);
    expect(incremental.leases[0].balance).toBe(oneShot.leases[0].balance);
  });

  function setup(input: { balance: string; leasePrices: string[]; lastWithdrawHeight: number | null }) {
    const deployment: SettlementDeployment = {
      balance: decFromString(input.balance),
      lastWithdrawHeight: input.lastWithdrawHeight,
      closedHeight: null
    };
    const leases: SettlementLease[] = input.leasePrices.map(price => ({
      price: decFromString(price),
      balance: 0n,
      closedHeight: null
    }));
    return { deployment, leases };
  }
});
