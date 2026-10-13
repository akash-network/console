import { describe, expect, it } from "vitest";

import { pickWalletBillingTarget, singletonKeyOf, walletBillingTargetOf } from "./wallet-billing-target";

describe("wallet billing target", () => {
  it("targets a personal wallet by its user and a team's wallet by its id", () => {
    expect(walletBillingTargetOf({ id: 7, userId: "user-1" })).toEqual({ userId: "user-1" });
    expect(walletBillingTargetOf({ id: 7, userId: null })).toEqual({ walletId: 7 });
  });

  it("keeps the user key formula and gives team wallets their own namespace", () => {
    expect(singletonKeyOf("WalletCreditsLowCheck", { userId: "user-1" })).toBe("WalletCreditsLowCheck.user-1");
    expect(singletonKeyOf("WalletCreditsLowCheck", { walletId: 7 })).toBe("WalletCreditsLowCheck.wallet.7");
  });

  it("drops whatever else a payload carries", () => {
    const userPayload = { userId: "user-1", firstClosingDseq: "1" };
    const walletPayload = { walletId: 7, triggeredByDeployment: true };

    expect(pickWalletBillingTarget(userPayload)).toEqual({ userId: "user-1" });
    expect(pickWalletBillingTarget(walletPayload)).toEqual({ walletId: 7 });
  });
});
