import escapeHtml from "lodash/escape";

import { toProviderHostName } from "@src/notifications/lib/provider-host-name/provider-host-name";
import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

/**
 * A provider's host URI is whatever it declared on chain, so it reaches this email as untrusted text
 * and is escaped before going into the markup.
 */
export function providerUnreachableClosedNotification(
  user: UserOutput,
  vars: { dseq: string; owner: string; hostUri: string; downForDays: number; redeployUrl: string }
): CreateNotificationInput {
  return {
    notificationId: `providerUnreachableClosed.${vars.dseq}.${vars.owner}`,
    payload: {
      summary: "Your Akash deployment was closed: provider unreachable",
      description:
        `Deployment <strong>${vars.dseq}</strong> has been closed. Its provider, ` +
        `<strong>${escapeHtml(toProviderHostName(vars.hostUri))}</strong>, stopped responding ${vars.downForDays} days ago and never came back, ` +
        `so the deployment was costing you money without running anything. What was left of its funds has been returned ` +
        `to your account.`,
      actions: [{ label: "Deploy it again", url: vars.redeployUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}
