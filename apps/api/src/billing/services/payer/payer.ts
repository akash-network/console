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

export type PayingPayer = Payer & { stripeCustomerId: string };

export function isPayingPayer(payer: Payer): payer is PayingPayer {
  return !!payer.stripeCustomerId;
}

export function assertIsPayingPayer(payer: Payer): asserts payer is PayingPayer {
  assert(isPayingPayer(payer), 402, payer.team ? "Organization payments are not set up." : "User payments are not set up.");
}

export function billingOwnerOf(payer: Pick<Payer, "user" | "team">): BillingOwner {
  return payer.team ? { organizationId: payer.team.id } : { userId: payer.user.id };
}
