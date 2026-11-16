import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import escape from "lodash/escape";

import type { ClosureNoticeInput, ClosureNoticeOutput } from "@src/modules/alert/repositories/closure-notice/closure-notice.repository";
import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";
import { getLeaseClosedReasonText } from "@src/modules/alert/services/reclaim-alert/lease-closed-reason";
import type { FeedEntriesCommandDto } from "@src/modules/notifications/dto/FeedEntriesCommand.dto";

/** SendGrid categories, so they must stay plain letters. */
export const CLOSURE_ALERT_CATEGORY = "deploymentClosureAlert";
export const CLOSURE_DIGEST_CATEGORY = "deploymentClosureDigest";

export type ClosureEmail = {
  category: typeof CLOSURE_ALERT_CATEGORY | typeof CLOSURE_DIGEST_CATEGORY;
  payload: AlertMessagePayload;
};

export function toClosureEmail(notices: ClosureNoticeOutput[]): ClosureEmail {
  if (notices.length === 1) {
    const [notice] = notices;

    return {
      category: CLOSURE_ALERT_CATEGORY,
      payload: {
        summary: summaryOf(notice),
        description: `${describe(notice)} Please visit ${notice.deploymentLink} to manage your deployment.`
      }
    };
  }

  return {
    category: CLOSURE_DIGEST_CATEGORY,
    payload: {
      summary: digestSummaryOf(notices),
      description: notices.map(notice => `<p>${describe(notice)} Manage it at ${notice.deploymentLink}.</p>`).join("")
    }
  };
}

function digestSummaryOf(notices: ClosureNoticeOutput[]): string {
  const deployments = `${notices.length} deployments`;
  return notices.every(notice => notice.deploymentClosed) ? `${deployments} were closed` : `${deployments} were closed or lost a lease`;
}

function summaryOf({ deploymentClosed, deploymentLabel }: Pick<ClosureNoticeInput, "deploymentClosed" | "deploymentLabel">): string {
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

/** Filed under the key console-api gives the deployment's close, so a close and the alert reporting it show as one entry. */
export function toDeploymentClosedFeedEntry(notice: ClosureNoticeInput): FeedEntriesCommandDto["feedEntries"][number] {
  const { alertId, userId, organizationId = null, projectId = null, owner, dseq } = notice;
  return { type: "deployment_closed_alert", alertId, userId, organizationId, projectId, dedupeKey: `deployment_close.${owner}.${dseq}`, dseq, summary: summaryOf(notice) };
}
