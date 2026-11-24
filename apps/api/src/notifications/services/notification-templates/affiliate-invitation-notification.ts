import type { AffiliateTerms } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

function wholeDollars(usd: number): string {
  return `$${Math.round(usd)}`;
}

export function affiliateInvitationNotification(user: UserOutput, vars: { terms: AffiliateTerms; referralsUrl: string }): CreateNotificationInput {
  const { terms } = vars;

  return {
    notificationId: `affiliateInvitation.${user.id}`,
    payload: {
      summary: "Earn Console credit by referring friends",
      description:
        `You can now refer people to Akash Console. Anyone who signs up with your link gets a ${wholeDollars(terms.referralTrialCreditsUsd)} trial. ` +
        `You earn ${wholeDollars(terms.firstPurchaseBonusUsd)} once they make a first payment of ${wholeDollars(terms.firstPurchaseBonusMinPaymentUsd)} or more ` +
        `and have used ${wholeDollars(terms.firstPurchaseBonusMinUsageUsd)} on deployments, ` +
        `plus ${terms.commissionPercent}% of every card payment they make for ${terms.commissionMonths} months. ` +
        `Your earnings arrive as Console credit after a ${terms.commissionHoldDays}-day hold, and you can't withdraw them.`,
      actions: [{ label: "Join the referral program", url: vars.referralsUrl }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
