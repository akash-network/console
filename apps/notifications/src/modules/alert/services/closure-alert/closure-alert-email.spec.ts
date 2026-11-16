import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { CLOSURE_ALERT_CATEGORY, CLOSURE_DIGEST_CATEGORY, toClosureEmail } from "./closure-alert-email";

import { generateClosureNotice } from "@test/seeders/closure-notice.seeder";

describe(toClosureEmail.name, () => {
  const LINK = '<a href="https://console.akash.network/deployments/1001?tab=SETTINGS">console.akash.network</a>';

  it("tells in one email that a deployment closed, why its lease closed and with which provider, and files it in the feed", () => {
    const notice = generateClosureNotice({
      dseq: "1001",
      deploymentLabel: "“my-app”",
      deploymentLink: LINK,
      providerLabel: "provider.example.com",
      leaseClosedReason: LeaseClosedReason.lease_closed_reason_insufficient_funds,
      organizationId: faker.string.uuid(),
      projectId: faker.string.uuid()
    });

    expect(toClosureEmail([notice])).toEqual({
      category: CLOSURE_ALERT_CATEGORY,
      payload: {
        summary: "Deployment “my-app” is now closed",
        description:
          "Deployment “my-app” was closed after its lease with provider provider.example.com was closed because the deployment has insufficient funds. " +
          `Please visit ${LINK} to manage your deployment.`,
        feedEntries: [
          {
            type: "deployment_closed_alert",
            alertId: notice.alertId,
            userId: notice.userId,
            organizationId: notice.organizationId,
            projectId: notice.projectId,
            dedupeKey: `deployment_close.${notice.owner}.1001`,
            dseq: "1001",
            summary: "Deployment “my-app” is now closed"
          }
        ]
      }
    });
  });

  it("tells that a deployment closed without a reason when no lease closure was reported for it", () => {
    const notice = generateClosureNotice({ dseq: "1001", deploymentLabel: "1001", deploymentLink: LINK });

    expect(toClosureEmail([notice]).payload).toEqual(
      expect.objectContaining({
        summary: "Deployment 1001 is now closed",
        description: `Deployment 1001 was closed. Please visit ${LINK} to manage your deployment.`
      })
    );
  });

  it("tells that a lease closed while its deployment stays open, keeping it out of the feed", () => {
    const notice = generateClosureNotice({
      deploymentLabel: "1001",
      deploymentLink: LINK,
      deploymentClosed: false,
      providerLabel: "provider.example.com",
      leaseClosedReason: LeaseClosedReason.lease_closed_reason_unstable
    });

    expect(toClosureEmail([notice])).toEqual({
      category: CLOSURE_ALERT_CATEGORY,
      payload: {
        summary: "The lease for deployment 1001 was closed",
        description:
          "The lease for deployment 1001 with provider provider.example.com was closed because the workload has been unstable, " +
          `so your workload is no longer running on that provider. Please visit ${LINK} to manage your deployment.`,
        feedEntries: []
      }
    });
  });

  it("escapes the deployment's and the provider's labels in the description", () => {
    const notice = generateClosureNotice({
      deploymentLabel: "“<b>Tom & Jerry</b>”",
      providerLabel: "<i>evil</i>",
      leaseClosedReason: LeaseClosedReason.lease_closed_reason_unstable
    });

    const { summary, description } = toClosureEmail([notice]).payload;

    expect(summary).toBe("Deployment “<b>Tom & Jerry</b>” is now closed");
    expect(description).toContain("Deployment “&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;” was closed after its lease with provider &lt;i&gt;evil&lt;/i&gt; was closed");
  });

  it("lists several closures in one digest, each with its reason and link, and files each closed deployment in the feed under its own summary", () => {
    const closed = generateClosureNotice({ dseq: "1001", deploymentLabel: "1001", deploymentLink: LINK });
    const leaseOnly = generateClosureNotice({
      dseq: "2002",
      deploymentLabel: "2002",
      deploymentLink: "LINK-2002",
      deploymentClosed: false,
      providerLabel: "provider.example.com",
      leaseClosedReason: LeaseClosedReason.lease_closed_reason_manifest_timeout
    });

    expect(toClosureEmail([closed, leaseOnly])).toEqual({
      category: CLOSURE_DIGEST_CATEGORY,
      payload: {
        summary: "Closure alerts for 2 deployments",
        description:
          `<p>Deployment 1001 was closed. Manage it at ${LINK}.</p>` +
          "<p>The lease for deployment 2002 with provider provider.example.com was closed because the manifest was not received in time, " +
          "so your workload is no longer running on that provider. Manage it at LINK-2002.</p>",
        feedEntries: [expect.objectContaining({ alertId: closed.alertId, dseq: "1001", summary: "Deployment 1001 is now closed" })]
      }
    });
  });

  it("keeps its SendGrid categories to plain letters", () => {
    expect([CLOSURE_ALERT_CATEGORY, CLOSURE_DIGEST_CATEGORY]).toEqual(["deploymentClosureAlert", "deploymentClosureDigest"]);
  });
});
