import { describe, expect, it } from "vitest";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { activityEntriesOf } from "./activityEntries";

import { buildActivity } from "@tests/seeders/activity";

describe(activityEntriesOf.name, () => {
  it("describes a close still running as closing its deployment, linking to it", () => {
    const activity = buildActivity({ status: "pending", meta: { dseq: "1234" } });

    expect(entriesOf([activity])).toEqual([
      { id: activity.id, status: "pending", title: "Closing “web-1234”", href: "/deployments/1234", createdAt: activity.createdAt, isUnseen: true }
    ]);
  });

  it("describes a finished close the user made as closed", () => {
    const [entry] = entriesOf([buildActivity({ status: "succeeded", initiator: "user", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ status: "succeeded", title: "Closed “web-1234”", href: "/deployments/1234" });
    expect(entry).not.toHaveProperty("detail");
  });

  it("describes a failed close with its reason, linking to the settings where the deployment can be closed again", () => {
    const [entry] = entriesOf([
      buildActivity({ status: "failed", meta: { dseq: "1234", error: { code: "close_incomplete", message: "The deployment is still open." } } })
    ]);

    expect(entry).toMatchObject({
      status: "failed",
      title: "Couldn't close “web-1234”",
      detail: "The deployment is still open.",
      href: "/deployments/1234?tab=SETTINGS"
    });
  });

  it("asks for another try when a failed close gives no reason", () => {
    const [entry] = entriesOf([buildActivity({ status: "failed", meta: { dseq: "1234" } })]);

    expect(entry.detail).toBe("Try closing it again.");
  });

  it.each([
    { status: "pending" as const, title: "Creating “web-1234”" },
    { status: "succeeded" as const, title: "Created “web-1234”" }
  ])("describes a $status create of its deployment, linking to choosing a provider for it", ({ status, title }) => {
    const [entry] = entriesOf([buildActivity({ type: "deployment_create", status, meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ status, title, href: "/new-deployment/configure/1234" });
  });

  it("describes a failed create with its reason, linking back to configuring a deployment to try again", () => {
    const [entry] = entriesOf([
      buildActivity({
        type: "deployment_create",
        status: "failed",
        meta: { dseq: "1234", error: { code: "create_incomplete", message: "The deployment was not created. Try creating it again." } }
      })
    ]);

    expect(entry).toMatchObject({
      status: "failed",
      title: "Couldn't create “web-1234”",
      detail: "The deployment was not created. Try creating it again.",
      href: "/new-deployment/configure"
    });
  });

  it("asks for another try when a failed create gives no reason", () => {
    const [entry] = entriesOf([buildActivity({ type: "deployment_create", status: "failed", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ detail: "Try creating it again." });
  });

  it.each([
    { status: "pending" as const, title: "Updating “web-1234”", href: "/deployments/1234" },
    { status: "succeeded" as const, title: "Updated “web-1234”", href: "/deployments/1234" }
  ])("describes a $status update of its deployment", ({ status, title, href }) => {
    const [entry] = entriesOf([buildActivity({ type: "deployment_update", status, meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ status, title, href });
  });

  it("describes a failed update with its reason, linking to the tab where the deployment can be updated again", () => {
    const [entry] = entriesOf([
      buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1234", error: { code: "update_failed", message: "Deployment closed" } } })
    ]);

    expect(entry).toMatchObject({ status: "failed", title: "Couldn't update “web-1234”", detail: "Deployment closed", href: "/deployments/1234?tab=UPDATE" });
  });

  it("asks for another try when a failed update gives no reason", () => {
    const [entry] = entriesOf([buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ detail: "Try updating it again." });
  });

  it("describes a deployment-closed alert by the deployment it names, linking to that deployment", () => {
    const activity = buildActivity({
      type: "deployment_closed_alert",
      status: "info",
      initiator: "system",
      meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "Deployment 1234 is now closed", dseq: "1234" }
    });

    expect(entriesOf([activity])).toEqual([
      { id: activity.id, status: "info", title: "“web-1234” was closed", href: "/deployments/1234", createdAt: activity.createdAt, isUnseen: true }
    ]);
  });

  it("starts a deployment alert with a capital letter when the deployment has no name", () => {
    const activity = buildActivity({
      type: "deployment_closed_alert",
      status: "info",
      initiator: "system",
      meta: { summary: "Deployment 1234 is now closed", dseq: "1234" }
    });

    const [entry] = activityEntriesOf([activity], dseq => `deployment ${dseq}`, 10);

    expect(entry.title).toBe("Deployment 1234 was closed");
  });

  it("describes a deployment alert naming no deployment by its summary", () => {
    const [entry] = entriesOf([
      buildActivity({ type: "deployment_closed_alert", status: "info", initiator: "system", meta: { summary: "Your deployment is now closed" } })
    ]);

    expect(entry).toEqual(expect.objectContaining({ title: "Your deployment is now closed", href: "/deployments" }));
    expect(entry).not.toHaveProperty("detail");
  });

  it("describes a reclaim alert by the deployment it names, linking to that deployment", () => {
    const activity = buildActivity({
      type: "deployment_reclaim_alert",
      status: "info",
      initiator: "system",
      meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "Deployment 1234 is being reclaimed by the provider", dseq: "1234" }
    });

    expect(entriesOf([activity])).toEqual([
      {
        id: activity.id,
        status: "info",
        title: "“web-1234” is being reclaimed by the provider",
        detail: "Take action before the lease is closed.",
        href: "/deployments/1234",
        createdAt: activity.createdAt,
        isUnseen: true
      }
    ]);
  });

  it("describes a team wallet's balance alert by its summary, never as a close Console made, linking to billing in that team", () => {
    const activity = buildActivity({
      type: "wallet_balance_alert",
      status: "info",
      initiator: "system",
      meta: {
        alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b",
        summary: "Wallet balance is below 10 AKT",
        organizationId: "9d3b8f0e-2c4a-4b1e-8f6d-7a5c3e1b9d2f"
      }
    });

    expect(entriesOf([activity])).toEqual([
      {
        id: activity.id,
        status: "info",
        title: "Wallet balance is below 10 AKT",
        href: "/billing?org=9d3b8f0e-2c4a-4b1e-8f6d-7a5c3e1b9d2f",
        createdAt: activity.createdAt,
        isUnseen: true
      }
    ]);
  });

  it("says one of the user's alerts fired when the alert carries no summary", () => {
    const [entry] = entriesOf([buildActivity({ type: "deployment_closed_alert", status: "info", initiator: "system", meta: {} })]);

    expect(entry).toMatchObject({ status: "info", title: "One of your alerts fired", href: "/deployments" });
  });

  it("describes a close Console made as Console closing the deployment, with its reason, linking to it", () => {
    const activity = buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234", reason: "provider_unreachable" } });

    expect(entriesOf([activity])).toEqual([
      {
        id: activity.id,
        status: "succeeded",
        title: "Console closed “web-1234”",
        detail: "Its provider stopped responding.",
        href: "/deployments/1234",
        createdAt: activity.createdAt,
        isUnseen: true
      }
    ]);
  });

  it("describes a close Console made for a reason it has no words for as a plain close by Console", () => {
    const [entry] = entriesOf([buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ title: "Console closed “web-1234”", detail: "It no longer runs or costs anything." });
  });

  it("links an activity about no particular deployment to the deployments list", () => {
    const [entry] = entriesOf([buildActivity({ status: "succeeded", meta: {} })]);

    expect(entry.href).toBe("/deployments");
  });

  it("describes a deployment still getting its lease as deploying, linking to it", () => {
    const [entry] = entriesOf([buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ status: "pending", title: "Deploying “web-1234”", href: "/deployments/1234" });
  });

  it("describes a deployment whose lease was created as deployed", () => {
    const [entry] = entriesOf([buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } })]);

    expect(entry).toMatchObject({ status: "succeeded", title: "Deployed “web-1234”", href: "/deployments/1234" });
  });

  it("describes a failed deployment with its reason, linking back to choosing a provider for it", () => {
    const [entry] = entriesOf([
      buildActivity({
        type: "lease_create",
        status: "failed",
        meta: { dseq: "1234", error: { code: "lease_not_created", message: "The lease was not created." } }
      })
    ]);

    expect(entry).toMatchObject({
      status: "failed",
      title: "Couldn't deploy “web-1234”",
      detail: "The lease was not created.",
      href: "/new-deployment/configure/1234"
    });
  });

  it("links a deployment its provider never received to the deployment, since its lease exists", () => {
    const [entry] = entriesOf([
      buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "1234", error: { code: "manifest_not_delivered", message: "Not sent." } } })
    ]);

    expect(entry.href).toBe("/deployments/1234");
  });

  it("asks to choose a provider again when a failed deployment gives no reason", () => {
    const [entry] = entriesOf([buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "1234" } })]);

    expect(entry.detail).toBe("Choose a provider again.");
  });

  it("links a deployment activity about no particular deployment to the deployments list", () => {
    const [entry] = entriesOf([buildActivity({ type: "lease_create", status: "succeeded", meta: {} })]);

    expect(entry.href).toBe("/deployments");
  });

  it("groups a bulk close into one entry, closing while any of it still runs", () => {
    const newest = buildActivity({ status: "pending", meta: { dseq: "1", batchId: "batch-1" } });
    const batch = [newest, buildActivity({ status: "succeeded", meta: { dseq: "2", batchId: "batch-1" } })];

    expect(entriesOf(batch)).toEqual([
      { id: "batch:batch-1", status: "pending", title: "Closing 2 deployments", href: "/deployments", createdAt: newest.createdAt, isUnseen: true }
    ]);
  });

  it("reports a bulk close as closed once every deployment in it closed", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded"), batchMember("2", "succeeded"), batchMember("3", "succeeded")]);

    expect(entry).toMatchObject({ status: "succeeded", title: "Closed 3 deployments" });
    expect(entry).not.toHaveProperty("detail");
  });

  it("reports a bulk close that closed none as failed, naming the deployments to close again", () => {
    const [entry] = entriesOf([batchMember("1", "failed"), batchMember("2", "failed")]);

    expect(entry).toMatchObject({ status: "failed", title: "Couldn't close 2 deployments", detail: "Try closing “web-1” and “web-2” again." });
  });

  it("reports a bulk close that closed some as partly done, naming the ones still open", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded"), batchMember("2", "failed"), batchMember("3", "succeeded")]);

    expect(entry).toMatchObject({ status: "partial", title: "Closed 2 of 3 deployments", detail: "Couldn't close “web-2”." });
  });

  it("keeps a bulk close of a single deployment as that deployment's entry", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded")]);

    expect(entry).toMatchObject({ title: "Closed “web-1”", href: "/deployments/1" });
  });

  it("tells an entry the user has already seen from one they haven't", () => {
    const entries = entriesOf([buildActivity({ seenAt: null }), buildActivity({ seenAt: "2026-10-20T10:00:00.000Z" })]);

    expect(entries.map(entry => entry.isUnseen)).toEqual([true, false]);
  });

  it("counts a bulk close as unseen while any close in it is", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded", "2026-10-20T10:00:00.000Z"), batchMember("2", "succeeded", null)]);

    expect(entry.isUnseen).toBe(true);
  });

  it("counts a bulk close as seen once every close in it is", () => {
    const [entry] = entriesOf([batchMember("1", "succeeded", "2026-10-20T10:00:00.000Z"), batchMember("2", "failed", "2026-10-20T10:00:00.000Z")]);

    expect(entry.isUnseen).toBe(false);
  });

  it("keeps the newest first and stops at the limit, counting a bulk close once", () => {
    const first = buildActivity({ meta: { dseq: "10" } });
    const third = buildActivity({ meta: { dseq: "30" } });
    const activities = [first, batchMember("1", "succeeded"), batchMember("2", "succeeded"), third, buildActivity({ meta: { dseq: "40" } })];

    const entries = entriesOf(activities, 3);

    expect(entries.map(entry => entry.id)).toEqual([first.id, "batch:batch-1", third.id]);
    expect(entries[1].title).toBe("Closed 2 deployments");
  });

  function batchMember(dseq: string, status: Activity["status"], seenAt: string | null = null) {
    return buildActivity({ status, seenAt, meta: { dseq, batchId: "batch-1" } });
  }

  function entriesOf(activities: Activity[], limit = 10) {
    return activityEntriesOf(activities, dseq => `“web-${dseq}”`, limit);
  }
});
