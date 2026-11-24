import type { AffiliateTerms } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

function wholeDollars(usd: number): string {
  return `$${Math.round(usd)}`;
}

function describeEarnings(terms: AffiliateTerms): string {
  const commission = `${terms.commissionPercent}% of every card payment they make for ${terms.commissionMonths} months`;

  if (terms.firstPurchaseBonusUsd <= 0) return `You earn ${commission}.`;

  return (
    `You earn ${commission}, plus ${wholeDollars(terms.firstPurchaseBonusUsd)} if their first payment is ${wholeDollars(terms.firstPurchaseBonusMinPaymentUsd)} or more, ` +
    `once they've used ${wholeDollars(terms.firstPurchaseBonusMinUsageUsd)} on deployments beyond their trial credit within those ${terms.commissionMonths} months.`
  );
}

export function affiliateInvitationNotification(user: UserOutput, vars: { terms: AffiliateTerms; referralsUrl: string }): CreateNotificationInput {
  const { terms } = vars;

  return {
    notificationId: `affiliateInvitation.${user.id}`,
    payload: {
      summary: "Earn Console credit by referring friends",
      description:
        `You can now refer people to Akash Console. Anyone who signs up with your link gets a ${wholeDollars(terms.referralTrialCreditsUsd)} trial. ` +
        `${describeEarnings(terms)} ` +
        `Your earnings arrive as Console credit after a ${terms.commissionHoldDays}-day hold, and you can't withdraw them.`,
      actions: [{ label: "Join the referral program", url: vars.referralsUrl }]
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
