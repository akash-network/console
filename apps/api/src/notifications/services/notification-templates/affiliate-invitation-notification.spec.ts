import { describe, expect, it } from "vitest";

import type { AffiliateTerms } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { affiliateInvitationNotification } from "./affiliate-invitation-notification";

import { createUser } from "@test/seeders/user.seeder";

const TERMS: AffiliateTerms = {
  commissionPercent: 5,
  commissionMonths: 3,
  referralTrialCreditsUsd: 5,
  commissionHoldDays: 30,
  firstPurchaseBonusUsd: 5,
  firstPurchaseBonusMinPaymentUsd: 20,
  firstPurchaseBonusMinUsageUsd: 20
};

describe(affiliateInvitationNotification.name, () => {
  it("invites the person to the referral program with its terms and a button to the referrals page", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const notification = affiliateInvitationNotification(user, { terms: TERMS, referralsUrl: "https://console.akash.network/referrals" });

    expect(notification).toEqual({
      notificationId: "affiliateInvitation.user-123",
      payload: {
        summary: "Earn Console credit by referring friends",
        description:
          "You can now refer people to Akash Console. Anyone who signs up with your link gets a $5 trial. " +
          "You earn 5% of every card payment they make for 3 months, plus $5 if their first payment is $20 or more, " +
          "once they've used $20 on deployments beyond their trial credit within those 3 months. " +
          "Your earnings arrive as Console credit after a 30-day hold, and you can't withdraw them.",
        actions: [{ label: "Join the referral program", url: "https://console.akash.network/referrals" }]
      },
      user: { id: "user-123", email: "user@example.com" }
    });
  });

  it("states every amount in whole dollars and follows the configured terms", () => {
    const user = createUser();

    const { payload } = affiliateInvitationNotification(user, {
      terms: {
        commissionPercent: 7,
        commissionMonths: 6,
        referralTrialCreditsUsd: 7.5,
        commissionHoldDays: 14,
        firstPurchaseBonusUsd: 10.4,
        firstPurchaseBonusMinPaymentUsd: 25,
        firstPurchaseBonusMinUsageUsd: 30
      },
      referralsUrl: "https://console.akash.network/referrals"
    });

    expect(payload.description).toBe(
      "You can now refer people to Akash Console. Anyone who signs up with your link gets a $8 trial. " +
        "You earn 7% of every card payment they make for 6 months, plus $10 if their first payment is $25 or more, " +
        "once they've used $30 on deployments beyond their trial credit within those 6 months. " +
        "Your earnings arrive as Console credit after a 14-day hold, and you can't withdraw them."
    );
  });

  it("leaves the first-payment bonus out when there is none", () => {
    const user = createUser();

    const { payload } = affiliateInvitationNotification(user, {
      terms: { ...TERMS, firstPurchaseBonusUsd: 0 },
      referralsUrl: "https://console.akash.network/referrals"
    });

    expect(payload.description).toBe(
      "You can now refer people to Akash Console. Anyone who signs up with your link gets a $5 trial. " +
        "You earn 5% of every card payment they make for 3 months. " +
        "Your earnings arrive as Console credit after a 30-day hold, and you can't withdraw them."
    );
  });
});
