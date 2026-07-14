import { describe, expect, it } from "vitest";

import { firstPurchaseBonusSentence } from "./first-purchase-bonus-offer";

describe(firstPurchaseBonusSentence.name, () => {
  it("returns an empty string when there is no offer", () => {
    expect(firstPurchaseBonusSentence(null)).toBe("");
    expect(firstPurchaseBonusSentence(undefined)).toBe("");
  });

  it("renders the offer terms when an offer is provided", () => {
    const sentence = firstPurchaseBonusSentence({ bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 });

    expect(sentence).toContain("10% in bonus credits");
    expect(sentence).toContain("first purchase of $100 or more");
    expect(sentence).toContain("up to $100");
    expect(sentence).toContain("<strong>");
  });
});
