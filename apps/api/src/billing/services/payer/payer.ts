import assert from "http-assert";

import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import type { UserOutput } from "@src/user/repositories";

export interface Payer {
  /** The member acting for the payer, recorded as `user_id` on the rows written for it. */
  user: UserOutput;
  /** The organization billed, recorded as `organization_id` on the rows written for it. */
  organizationId?: string;
  /** Present when a team organization pays, with its own Stripe customer; any other payer is the acting user. */
  team?: OrganizationOutput;
  stripeCustomerId: string | null;
}

/** A team a job charges after the member who set up its auto reload has deleted their account, so no member acts for it. */
export type MemberlessTeamPayer = Omit<Payer, "user" | "team" | "organizationId"> & { user: null; organizationId: string; team: OrganizationOutput };

/** Whoever a job charges, which only a team can be without an acting member. */
export type ChargedPayer = Payer | MemberlessTeamPayer;

export type PayingPayer = Payer & { stripeCustomerId: string };

export function isPayingPayer<P extends Pick<Payer, "stripeCustomerId">>(payer: P): payer is P & { stripeCustomerId: string } {
  return !!payer.stripeCustomerId;
}

export function assertIsPayingPayer(payer: Payer): asserts payer is PayingPayer {
  assert(isPayingPayer(payer), 402, payer.team ? "Organization payments are not set up." : "User payments are not set up.");
}

export function isTeamPayer<P extends Pick<ChargedPayer, "team">>(payer: P): payer is P & { team: OrganizationOutput } {
  return !!payer.team;
}

export function billingOwnerOf(payer: Pick<Payer, "user" | "team"> | Pick<MemberlessTeamPayer, "user" | "team">): BillingOwner {
  return isTeamPayer(payer) ? { organizationId: payer.team.id } : { userId: payer.user.id };
}
