import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import escape from "lodash/escape";

import type { ClosureNoticeOutput } from "@src/modules/alert/repositories/closure-notice/closure-notice.repository";
import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";
import { getLeaseClosedReasonText } from "@src/modules/alert/services/reclaim-alert/lease-closed-reason";
import type { AlertFeedEntry } from "@src/modules/notifications/dto/NotificationCommand.dto";

/** SendGrid categories, so they must stay plain letters. */
export const CLOSURE_ALERT_CATEGORY = "deploymentClosureAlert";
export const CLOSURE_DIGEST_CATEGORY = "deploymentClosureDigest";

export type ClosureEmail = {
  category: typeof CLOSURE_ALERT_CATEGORY | typeof CLOSURE_DIGEST_CATEGORY;
  payload: AlertMessagePayload;
};

export function toClosureEmail(notices: ClosureNoticeOutput[]): ClosureEmail {
  const feedEntries = notices.flatMap(feedEntriesOf);

  if (notices.length === 1) {
    const [notice] = notices;

    return {
      category: CLOSURE_ALERT_CATEGORY,
      payload: {
        summary: summaryOf(notice),
        description: `${describe(notice)} Please visit ${notice.deploymentLink} to manage your deployment.`,
        feedEntries
      }
    };
  }

  return {
    category: CLOSURE_DIGEST_CATEGORY,
    payload: {
      summary: `${notices.length} deployments were closed`,
      description: notices.map(notice => `<p>${describe(notice)} Manage it at ${notice.deploymentLink}.</p>`).join(""),
      feedEntries
    }
  };
}

function summaryOf({ deploymentClosed, deploymentLabel }: ClosureNoticeOutput): string {
  return deploymentClosed ? `Deployment ${deploymentLabel} is now closed` : `The lease for deployment ${deploymentLabel} was closed`;
}

function describe(notice: ClosureNoticeOutput): string {
  const label = escape(notice.deploymentLabel);
  const leaseClosure = leaseClosureOf(notice);

  if (!notice.deploymentClosed) {
    return `The lease for deployment ${label} ${leaseClosure}, so your workload is no longer running on that provider.`;
  }

  return leaseClosure ? `Deployment ${label} was closed after its lease ${leaseClosure}.` : `Deployment ${label} was closed.`;
}

function leaseClosureOf({ providerLabel, leaseClosedReason }: ClosureNoticeOutput): string | undefined {
  if (providerLabel === null) return undefined;

  return `with provider ${escape(providerLabel)} was closed because ${getLeaseClosedReasonText(leaseClosedReason ?? LeaseClosedReason.UNRECOGNIZED)}`;
}

/** Only a closed deployment reaches the feed, under the key console-api gives its close, so a close and the alert reporting it show as one entry. */
function feedEntriesOf(notice: ClosureNoticeOutput): AlertFeedEntry[] {
  if (!notice.deploymentClosed) return [];

  const { alertId, userId, organizationId, projectId, owner, dseq } = notice;
  return [{ type: "deployment_closed_alert", alertId, userId, organizationId, projectId, dedupeKey: `deployment_close.${owner}.${dseq}`, dseq, summary: summaryOf(notice) }];
}
